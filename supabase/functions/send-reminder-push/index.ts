// Supabase Edge Function: send-reminder-push
// Invoked daily by a pg_cron job. Sends Web Push notifications for
// reminders that are due today (in IST), grouped per user.
//
// Required secrets:
//   VAPID_PUBLIC_KEY  - generated with: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY - generated with: npx web-push generate-vapid-keys
//   VAPID_SUBJECT     - e.g. "mailto:your-email@example.com"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface ReminderRow {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: string;
  custom_type_label: string | null;
  due_date: string;
}

function istDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@mtwallet.app";

    const today = istDateString(new Date());

    // Pull all non-completed reminders; filter to today by IST date in JS
    // so we don't need SQL timezone gymnastics.
    const { data: allReminders, error: remindersErr } = await supabase
      .from("reminders")
      .select("id, user_id, title, amount, type, custom_type_label, due_date")
      .eq("is_completed", false);

    if (remindersErr) {
      throw new Error(`Failed to fetch reminders: ${remindersErr.message}`);
    }

    const dueToday = ((allReminders ?? []) as ReminderRow[]).filter(
      (r) => istDateString(new Date(r.due_date)) === today,
    );

    if (dueToday.length === 0) {
      return new Response(
        JSON.stringify({ message: "No reminders due today", date: today }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Group by user
    const byUser = new Map<string, ReminderRow[]>();
    for (const r of dueToday) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    const summary = {
      date: today,
      usersNotified: 0,
      pushesSent: 0,
      pushesFailed: 0,
      expiredRemoved: 0,
    };

    for (const [userId, reminders] of byUser) {
      const { data: subs, error: subsErr } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (subsErr) {
        console.error(`Failed to fetch push_subscriptions for ${userId}:`, subsErr.message);
        continue;
      }
      if (!subs || subs.length === 0) continue;

      let title: string;
      let body: string;
      if (reminders.length === 1) {
        const r = reminders[0];
        title = r.title;
        body = `₹${formatAmount(r.amount)} due today`;
      } else {
        title = `${reminders.length} reminders due today`;
        const MAX = 3;
        const lines = reminders.slice(0, MAX).map(
          (r) => `• ${r.title} ₹${formatAmount(r.amount)}`,
        );
        if (reminders.length > MAX) {
          lines.push(`… and ${reminders.length - MAX} more`);
        }
        body = lines.join("\n");
      }

      const notificationPayload = JSON.stringify({
        title,
        body,
        url: "/reminders?filter=pending",
      });

      summary.usersNotified++;

      for (const sub of subs as PushSubscription[]) {
        try {
          const resp = await sendWebPush(sub, notificationPayload, {
            vapidPublicKey, vapidPrivateKey, vapidSubject,
          });
          if (resp.status === 410 || resp.status === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            summary.expiredRemoved++;
          } else if (resp.ok || resp.status === 201) {
            summary.pushesSent++;
          } else {
            summary.pushesFailed++;
            console.error(`Push to ${sub.endpoint.slice(0, 50)}… failed: ${resp.status}`);
          }
        } catch (err) {
          summary.pushesFailed++;
          console.error("Push send threw:", err);
        }
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-reminder-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// --- Web Push Implementation using VAPID + RFC 8291 Encryption ---

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (str.length % 4)) % 4;
  str += "=".repeat(padding);
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: audience, exp: now + 12 * 60 * 60, sub: vapidSubject };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const publicKeyBytes = base64UrlDecode(vapidPublicKey);
  const x = base64UrlEncode(publicKeyBytes.slice(1, 33));
  const y = base64UrlEncode(publicKeyBytes.slice(33, 65));
  const d = base64UrlEncode(privateKeyBytes);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    toArrayBuffer(new TextEncoder().encode(unsignedToken)),
  );

  const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;
  return `vapid t=${jwt}, k=${vapidPublicKey}`;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const hkdfKey = await crypto.subtle.importKey("raw", toArrayBuffer(ikm), "HKDF", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(salt), info: toArrayBuffer(info) },
    hkdfKey,
    length * 8,
  );
  return new Uint8Array(derived);
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: Uint8Array,
): Promise<{ encrypted: Uint8Array; serverPublicKeyBytes: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
  const clientAuthBytes = base64UrlDecode(clientAuthB64);

  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const serverPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey),
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(clientPublicKeyBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeys.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = concatBuffers(
    encoder.encode("WebPush: info\0"),
    clientPublicKeyBytes,
    serverPublicKeyBytes,
  );
  const ikm = await hkdf(clientAuthBytes, sharedSecret, authInfo, 32);

  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  const paddedPayload = concatBuffers(payload, new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey("raw", toArrayBuffer(cek), "AES-GCM", false, ["encrypt"]);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(nonce) },
    aesKey,
    toArrayBuffer(paddedPayload),
  );

  return {
    encrypted: new Uint8Array(encryptedBuffer),
    serverPublicKeyBytes,
    salt,
  };
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string },
): Promise<Response> {
  const payloadBytes = new TextEncoder().encode(payload);

  const { encrypted, serverPublicKeyBytes, salt } = await encryptPayload(
    subscription.p256dh,
    subscription.auth,
    payloadBytes,
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer as ArrayBuffer).setUint32(0, 4096);
  const idlen = new Uint8Array([serverPublicKeyBytes.length]);
  const header = concatBuffers(salt, rs, idlen, serverPublicKeyBytes);
  const body = concatBuffers(header, encrypted);

  const authHeader = await createVapidAuthHeader(
    subscription.endpoint,
    vapid.vapidPublicKey,
    vapid.vapidPrivateKey,
    vapid.vapidSubject,
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body: toArrayBuffer(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`Push failed (${response.status}): ${text}`);
  }

  return response;
}

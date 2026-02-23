// Supabase Edge Function: send-push-notification
// Triggered by a Database Webhook on sync_runs INSERT
//
// Reads push subscriptions for the user and sends Web Push notifications.
//
// Required secrets:
//   VAPID_PUBLIC_KEY  - generated with: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY - generated with: npx web-push generate-vapid-keys
//   VAPID_SUBJECT     - e.g. "mailto:your-email@example.com"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push crypto helpers for Deno
// We use the web-push protocol directly since Deno doesn't have the node web-push library

interface PushSubscription {
    endpoint: string;
    p256dh: string;
    auth: string;
}

interface SyncRunPayload {
    type: "INSERT";
    table: "sync_runs";
    record: {
        id: string;
        user_id: string;
        status: string;
        inserted: number;
        skipped: number;
        errors: number;
        total_messages: number;
    };
}

serve(async (req) => {
    try {
        const payload: SyncRunPayload = await req.json();
        const { record } = payload;

        // Only notify if transactions were actually inserted
        if (!record.inserted || record.inserted === 0) {
            return new Response(JSON.stringify({ message: "No new transactions, skipping notification" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Initialize Supabase admin client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get push subscriptions for this user
        const { data: subscriptions, error } = await supabase
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", record.user_id);

        if (error || !subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: "No push subscriptions found" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Build notification payload
        const notificationPayload = JSON.stringify({
            title: "MTWallet — Sync Complete",
            body: `${record.inserted} new transaction${record.inserted > 1 ? "s" : ""} synced${record.errors > 0 ? ` (${record.errors} error${record.errors > 1 ? "s" : ""})` : ""}`,
            url: "/transactions",
            syncRunId: record.id,
        });

        // Get VAPID keys from secrets
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
        const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@mtwallet.app";

        // Send push to each subscription
        const results = await Promise.allSettled(
            subscriptions.map(async (sub: PushSubscription) => {
                try {
                    const response = await sendWebPush(sub, notificationPayload, {
                        vapidPublicKey,
                        vapidPrivateKey,
                        vapidSubject,
                    });

                    // Clean up expired subscriptions (410 Gone or 404 Not Found)
                    if (response.status === 410 || response.status === 404) {
                        await supabase
                            .from("push_subscriptions")
                            .delete()
                            .eq("endpoint", sub.endpoint);
                        return { endpoint: sub.endpoint, status: "expired_removed" };
                    }

                    return { endpoint: sub.endpoint, status: response.status };
                } catch (err) {
                    return { endpoint: sub.endpoint, status: "error", error: String(err) };
                }
            })
        );

        return new Response(JSON.stringify({ sent: results.length, results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
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
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
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

/** Convert a Uint8Array to a strict ArrayBuffer (works around TS 5.7+ ArrayBufferLike narrowing). */
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

/**
 * Create VAPID JWT authorization header
 */
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
    const claims = {
        aud: audience,
        exp: now + 12 * 60 * 60,
        sub: vapidSubject,
    };

    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const claimsB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
    const unsignedToken = `${headerB64}.${claimsB64}`;

    // Import VAPID private key for signing
    // WebCrypto cannot import ECDSA private keys as "raw" — must use JWK format.
    // VAPID private key is a 32-byte raw scalar; combined with the public key to form JWK.
    const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
    const publicKeyBytes = base64UrlDecode(vapidPublicKey);
    // The public key is an uncompressed 65-byte point (0x04 || x || y)
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

    // Sign the JWT
    const signatureBuffer = await crypto.subtle.sign(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        privateKey,
        toArrayBuffer(new TextEncoder().encode(unsignedToken)),
    );

    // ECDSA signature from WebCrypto is in IEEE P1363 format (r||s, 64 bytes)
    // VAPID expects this format directly, so no DER conversion needed
    const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signatureBuffer))}`;

    return `vapid t=${jwt}, k=${vapidPublicKey}`;
}

/**
 * HKDF-SHA256 key derivation
 */
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

/**
 * Encrypt the push payload using RFC 8291 (aes128gcm)
 */
async function encryptPayload(
    clientPublicKeyB64: string,
    clientAuthB64: string,
    payload: Uint8Array,
): Promise<{ encrypted: Uint8Array; serverPublicKeyBytes: Uint8Array; salt: Uint8Array }> {
    const encoder = new TextEncoder();

    // Decode client subscription keys
    const clientPublicKeyBytes = base64UrlDecode(clientPublicKeyB64);
    const clientAuthBytes = base64UrlDecode(clientAuthB64);

    // Generate a new ephemeral ECDH key pair for this message
    const serverKeys = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"],
    );

    // Export server public key as uncompressed point (65 bytes)
    const serverPublicKeyBytes = new Uint8Array(
        await crypto.subtle.exportKey("raw", serverKeys.publicKey),
    );

    // Import client public key for ECDH
    const clientPublicKey = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(clientPublicKeyBytes),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        [],
    );

    // ECDH shared secret
    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: "ECDH", public: clientPublicKey },
            serverKeys.privateKey,
            256,
        ),
    );

    // Generate random 16-byte salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // --- RFC 8291 Section 3.4: IKM derivation ---
    // IKM = HKDF-Extract(auth_secret, ecdh_secret)
    //       then HKDF-Expand with info = "WebPush: info\0" || ua_public || as_public
    const authInfo = concatBuffers(
        encoder.encode("WebPush: info\0"),
        clientPublicKeyBytes,
        serverPublicKeyBytes,
    );
    const ikm = await hkdf(clientAuthBytes, sharedSecret, authInfo, 32);

    // --- RFC 8188 Section 2.2: CEK and nonce derivation for aes128gcm ---
    // cek_info = "Content-Encoding: aes128gcm\0"
    // nonce_info = "Content-Encoding: nonce\0"
    const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
    const nonceInfo = encoder.encode("Content-Encoding: nonce\0");

    const cek = await hkdf(salt, ikm, cekInfo, 16);
    const nonce = await hkdf(salt, ikm, nonceInfo, 12);

    // --- RFC 8188 Section 2: Pad the plaintext ---
    // For a single-record message: plaintext || delimiter (0x02) || padding (zeros)
    // 0x02 = final record delimiter
    const paddedPayload = concatBuffers(payload, new Uint8Array([2]));

    // Encrypt with AES-128-GCM
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

/**
 * Send an encrypted Web Push notification
 */
async function sendWebPush(
    subscription: PushSubscription,
    payload: string,
    vapid: { vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string },
): Promise<Response> {
    const payloadBytes = new TextEncoder().encode(payload);

    // Encrypt the payload
    const { encrypted, serverPublicKeyBytes, salt } = await encryptPayload(
        subscription.p256dh,
        subscription.auth,
        payloadBytes,
    );

    // Build the aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
    const rs = new Uint8Array(4);
    new DataView(rs.buffer as ArrayBuffer).setUint32(0, 4096);
    const idlen = new Uint8Array([serverPublicKeyBytes.length]);
    const header = concatBuffers(salt, rs, idlen, serverPublicKeyBytes);
    const body = concatBuffers(header, encrypted);

    // Create VAPID authorization
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

// Supabase Edge Function: ingest-sms
// Receives raw SMS messages, uses Gemini to parse transactions, inserts to DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface SMSMessage {
  id: number;
  sender: string;
  body: string;
  timestamp: string | null;
}

interface ParsedTransaction {
  is_transaction: boolean;
  amount?: number;
  direction?: "credit" | "debit";
  merchant?: string;
  payment_method?: "upi" | "card" | "neft" | "imps" | "netbanking" | "wallet" | "other";
  account_last4?: string;
  bank_name?: string;
  reference_id?: string;
  confidence?: "high" | "medium" | "low";
  skip_reason?: string;
}

const PARSING_PROMPT = `You are a financial transaction parser for Indian banking SMS messages.

TASK: For each SMS, determine if it's a financial transaction and extract details.

OUTPUT FORMAT: Return a JSON array with one object per input SMS, in the same order.

Each object must have:
- "is_transaction": boolean (true if this is a real money transaction)
- If is_transaction is true, also include:
  - "amount": number (the actual transaction amount in INR, NOT available balance)
  - "direction": "credit" or "debit"
  - "merchant": string or null (who the payment was to/from)
  - "payment_method": "upi" | "card" | "neft" | "imps" | "netbanking" | "wallet" | "other"
  - "account_last4": string or null (last 4 digits of card/account)
  - "bank_name": string or null
  - "reference_id": string or null (UPI ref, txn ID)
  - "confidence": "high" | "medium" | "low"
- If is_transaction is false:
  - "skip_reason": string (why this is not a transaction)

IMPORTANT RULES:
1. OTPs, verification codes, login alerts = NOT transactions
2. "Transaction declined/failed" = NOT transactions (no money moved)
3. Balance alerts without transaction = NOT transactions
4. EMI conversion notices = NOT transactions (just restructuring existing debt)
5. Promotional offers = NOT transactions

6. For USD/foreign currency transactions:
   - The amount spent is in foreign currency, but extract the INR equivalent if shown
   - If SMS shows "USD 5.90" and "INR 500", use 500 as amount
   - If only foreign amount shown, set amount to null and note in merchant

7. "debited" = debit (money going out)
8. "credited" = credit (money coming in)
9. "spent" = debit
10. "received" = credit

11. For UPI: extract UPI ID as merchant (e.g., "merchant@upi")
12. For cards: extract last 4 digits from "Card XX1234" or "Card ending 1234"

13. Amount is NEVER the "Available Balance" or "Avl Limit" - those are account balances, not transaction amounts.

RETURN ONLY THE JSON ARRAY. No markdown, no explanation.

Example input:
[
  {"id": 1, "body": "Rs.234 spent on HDFC Card ending 5487 at SWIGGY on 2026-01-29"},
  {"id": 2, "body": "Your OTP is 123456. Valid for 5 mins."},
  {"id": 3, "body": "USD 5.90 spent using ICICI Card XX4007. INR Equiv: 492.50"}
]

Example output:
[
  {"is_transaction": true, "amount": 234, "direction": "debit", "merchant": "SWIGGY", "payment_method": "card", "account_last4": "5487", "bank_name": "HDFC Bank", "reference_id": null, "confidence": "high"},
  {"is_transaction": false, "skip_reason": "OTP message"},
  {"is_transaction": true, "amount": 492.50, "direction": "debit", "merchant": "Foreign transaction", "payment_method": "card", "account_last4": "4007", "bank_name": "ICICI Bank", "reference_id": null, "confidence": "medium"}
]

Now parse these messages:`;

async function parseWithGemini(
  messages: SMSMessage[],
  geminiApiKey: string
): Promise<ParsedTransaction[]> {
  // Prepare messages for the prompt
  const messagesForPrompt = messages.map((m) => ({
    id: m.id,
    body: m.body,
  }));

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: PARSING_PROMPT + "\n" + JSON.stringify(messagesForPrompt, null, 2),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topP: 1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();

  // Extract text from Gemini response
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text in Gemini response");
  }

  // Clean up response (remove markdown if present)
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  // Parse JSON
  const parsed = JSON.parse(cleanedText);
  if (!Array.isArray(parsed)) {
    throw new Error("Gemini did not return an array");
  }

  return parsed;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, api_key } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: "api_key required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key and get user
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("api_key", api_key)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = profile.user_id;
    console.log(`Processing ${messages.length} SMS for user ${userId.substring(0, 8)}...`);

    // Parse messages with Gemini
    let parsed: ParsedTransaction[];
    try {
      parsed = await parseWithGemini(messages, geminiApiKey);
    } catch (parseError) {
      console.error("Gemini parsing error:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse SMS with AI", details: String(parseError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch categorization rules for this user
    const { data: rules } = await supabase
      .from("categorization_rules")
      .select("merchant_pattern, category_id, merchant_normalized")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("priority", { ascending: false });

    // Process each parsed transaction
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const txn = parsed[i];

      if (!txn || !txn.is_transaction) {
        skipped++;
        continue;
      }

      // Skip if missing required fields
      if (!txn.amount || !txn.direction) {
        console.log(`Skipping message ${msg.id}: missing amount or direction`);
        skipped++;
        continue;
      }

      // Match against categorization rules
      let categoryId: string | null = null;
      let merchantNormalized = txn.merchant;

      if (rules && txn.merchant) {
        for (const rule of rules) {
          try {
            const regex = new RegExp(rule.merchant_pattern, "i");
            if (regex.test(txn.merchant) || regex.test(msg.body)) {
              categoryId = rule.category_id;
              merchantNormalized = rule.merchant_normalized || txn.merchant;
              break;
            }
          } catch {
            // Invalid regex, skip this rule
          }
        }
      }

      // Prepare transaction record
      const transactionData = {
        user_id: userId,
        amount: txn.amount,
        direction: txn.direction,
        transacted_at: msg.timestamp || new Date().toISOString(),
        merchant: txn.merchant,
        merchant_normalized: merchantNormalized,
        payment_method: txn.payment_method,
        account_last4: txn.account_last4,
        bank_name: txn.bank_name,
        reference_id: txn.reference_id,
        raw_sms: msg.body,
        sms_id: msg.id,
        sms_sender: msg.sender,
        source: "sms",
        category_id: categoryId,
      };

      // Insert transaction
      const { error: insertError } = await supabase
        .from("transactions")
        .upsert(transactionData, {
          onConflict: "user_id,sms_id",
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error(`Error inserting transaction for SMS ${msg.id}:`, insertError);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`Completed: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        skipped,
        errors,
        total: messages.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

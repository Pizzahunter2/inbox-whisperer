import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Token encryption (AES-256-GCM) ---
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!keyHex) throw new Error('TOKEN_ENCRYPTION_KEY not configured');
  const keyBytes = new Uint8Array(keyHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(12 + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decryptTokenSafe(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return value;
  }
}
// --- End token encryption ---

async function refreshTokenIfNeeded(
  supabase: any,
  account: any,
  userId: string,
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(account.token_expires_at);

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshToken = await decryptTokenSafe(account.refresh_token_encrypted);
    if (!refreshToken) return null;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await response.json();
    if (tokenData?.error) {
      console.error("Token refresh error:", tokenData);
      return null;
    }

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const encryptedAccess = await encryptToken(tokenData.access_token);

    await supabase
      .from("connected_accounts")
      .update({
        access_token_encrypted: encryptedAccess,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "gmail");

    return tokenData.access_token;
  }

  return await decryptTokenSafe(account.access_token_encrypted);
}

function toBase64Url(str: string) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createRfc822Raw(toEmail: string, subject: string, body: string): string {
  const emailLines = [
    `To: ${toEmail}`,
    `Subject: Re: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];

  return toBase64Url(emailLines.join("\r\n"));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messageId, toEmail, subject, replyText } = body;
    // Note: threadId is optional and often not available from provider_message_id

    if (!messageId || !toEmail || !subject || !replyText) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: messageId, toEmail, subject, replyText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: account, error: accountError } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .single();

    if (accountError || !account || account.status !== "connected") {
      return new Response(
        JSON.stringify({ error: "Gmail not connected. Please connect your Google account in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await refreshTokenIfNeeded(supabase, account, user.id);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to refresh token. Please reconnect your Google account." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const raw = createRfc822Raw(toEmail, subject, replyText);
    const sendPayload: any = { raw };
    // Don't include threadId - it causes issues when provider_message_id is passed instead

    const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendPayload),
    });

    const sendResult = await sendResponse.json();
    if (sendResult?.error) {
      console.error("Gmail send error:", sendResult.error);

      if (sendResult.error.code === 403) {
        return new Response(
          JSON.stringify({
            error: "Permission denied. Please reconnect your Google account with send permissions.",
            needsReconnect: true,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to send email. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("messages").update({ processed: true }).eq("id", messageId);

    const { data: existingOutcome } = await supabase
      .from("outcomes")
      .select("id")
      .eq("message_id", messageId)
      .single();

    if (existingOutcome) {
      await supabase
        .from("outcomes")
        .update({
          final_action: "reply",
          final_reply_text: replyText,
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("message_id", messageId);
    } else {
      await supabase.from("outcomes").insert([
        {
          message_id: messageId,
          final_action: "reply",
          final_reply_text: replyText,
          status: "sent",
        },
      ]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        gmailMessageId: sendResult.id,
        threadId: sendResult.threadId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

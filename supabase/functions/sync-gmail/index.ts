import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
    return value; // Plaintext fallback during migration
  }
}
// --- End token encryption ---

async function refreshTokenIfNeeded(
  supabase: any,
  account: any,
  userId: string
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(account.token_expires_at);

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshToken = await decryptTokenSafe(account.refresh_token_encrypted);
    if (!refreshToken) return null;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await response.json();
    if (tokenData.error) {
      console.error('Token refresh error:', tokenData);
      return null;
    }

    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    const encryptedAccess = await encryptToken(tokenData.access_token);

    await supabase
      .from('connected_accounts')
      .update({
        access_token_encrypted: encryptedAccess,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'gmail');

    return tokenData.access_token;
  }

  return await decryptTokenSafe(account.access_token_encrypted);
}

// Decode base64url-encoded body data
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return atob(base64);
  } catch {
    return '';
  }
}

// Recursively extract body text from Gmail message payload
// Prefers text/plain, falls back to text/html (stripped of tags)
function extractBody(payload: any): string {
  if (!payload) return '';

  let plainText = '';
  let htmlText = '';

  function walkParts(part: any) {
    const mimeType = part.mimeType || '';

    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mimeType === 'text/plain') {
        plainText += decoded;
      } else if (mimeType === 'text/html') {
        htmlText += decoded;
      }
    }

    if (part.parts) {
      for (const child of part.parts) {
        walkParts(child);
      }
    }
  }

  walkParts(payload);

  // If we have HTML, strip tags but preserve structure for better text extraction
  if (htmlText && !plainText) {
    plainText = htmlText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/th>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, (_m: string, c: string) => String.fromCharCode(parseInt(c)))
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Truncate to ~10000 chars to avoid DB bloat but keep enough for AI analysis
  return plainText.slice(0, 10000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get connected Gmail account
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .single();

    if (accountError || !account || account.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, account, user.id);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent messages from Gmail - all inbox emails from last 7 days
    const gmailQuery = encodeURIComponent('in:inbox newer_than:7d');
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${gmailQuery}&maxResults=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const messagesData = await messagesResponse.json();

    if (messagesData.error) {
      console.error('Gmail API error:', messagesData.error);
      return new Response(
        JSON.stringify({ error: 'Failed to sync Gmail. Please try again or reconnect your account.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = messagesData.messages || [];
    const importedMessages = [];
    let skippedDuplicates = 0;

    for (const msg of messages) {
      // Use upsert with ON CONFLICT to handle duplicates gracefully
      // First fetch the message details

      // Fetch full message details
      const msgDetailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const msgDetail = await msgDetailResponse.json();
      const headers = msgDetail.payload?.headers || [];

      const getHeader = (name: string) => 
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || '(No Subject)';
      const from = getHeader('From') || '';
      const date = getHeader('Date');

      // Parse from email and name
      const fromMatch = from.match(/^(?:(.+?)\s*)?<?([^<>]+@[^<>]+)>?$/);
      const fromName = fromMatch?.[1]?.replace(/"/g, '') || null;
      const fromEmail = fromMatch?.[2] || from;

      // Get body snippet
      const bodySnippet = msgDetail.snippet || '';

      // Extract full body from message parts
      const bodyFull = extractBody(msgDetail.payload) || bodySnippet;

      // Upsert message (insert or ignore if exists)
      const { data: newMessage, error: upsertError } = await supabase
        .from('messages')
        .upsert(
          {
            user_id: user.id,
            provider_message_id: msg.id,
            subject,
            from_email: fromEmail,
            from_name: fromName,
            body_snippet: bodySnippet,
            body_full: bodyFull,
            received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
            is_demo: false,
            processed: false,
          },
          {
            onConflict: 'user_id,provider_message_id',
            ignoreDuplicates: true,
          }
        )
        .select()
        .maybeSingle();

      if (upsertError) {
        console.error('Upsert error for message:', msg.id, upsertError);
      } else if (newMessage) {
        importedMessages.push(newMessage);
      } else {
        // ignoreDuplicates=true yields no returned row when the message already exists
        skippedDuplicates++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: importedMessages.length,
        skipped: skippedDuplicates,
        total: messages.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync Gmail' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

async function refreshTokenIfNeeded(
  supabase: any,
  account: any,
  userId: string
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(account.token_expires_at);

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!account.refresh_token_encrypted) {
      return null;
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token_encrypted,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await response.json();

    if (tokenData.error) {
      console.error('Token refresh error:', tokenData);
      return null;
    }

    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    await supabase
      .from('connected_accounts')
      .update({
        access_token_encrypted: tokenData.access_token,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'gmail');

    return tokenData.access_token;
  }

  return account.access_token_encrypted;
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

    // Fetch recent messages from Gmail - PRIMARY inbox, last 7 days
    // Using 'newer_than:7d' to get recent emails, not just unread
    const gmailQuery = encodeURIComponent('category:primary -category:promotions -category:social -category:updates newer_than:7d');
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
        JSON.stringify({ error: 'Gmail API error', details: messagesData.error }),
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

      // Get full body (simplified - just the snippet for now)
      const bodyFull = bodySnippet;

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

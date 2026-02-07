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

  // Refresh if token expires within 5 minutes
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

function createEmailBody(to: string, subject: string, body: string, threadId?: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: Re: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ];

  const email = emailLines.join('\r\n');
  
  // Base64 URL encode the email
  const base64Email = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64Email;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    const { messageId, to, subject, body, threadId } = await req.json();

    if (!messageId || !to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messageId, to, subject, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        JSON.stringify({ error: 'Gmail not connected. Please reconnect with updated permissions.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await refreshTokenIfNeeded(supabase, account, user.id);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token. Please reconnect your Google account.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the email
    const rawEmail = createEmailBody(to, subject, body, threadId);

    // Send via Gmail API
    const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    const sendPayload: any = { raw: rawEmail };
    if (threadId) {
      sendPayload.threadId = threadId;
    }

    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPayload),
    });

    const sendResult = await sendResponse.json();

    if (sendResult.error) {
      console.error('Gmail send error:', sendResult.error);
      
      // Check for permission/scope errors
      if (sendResult.error.code === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'Permission denied. Please reconnect your Google account with send permissions.',
            needsReconnect: true 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message as processed
    await supabase
      .from('messages')
      .update({ processed: true })
      .eq('id', messageId);

    // Upsert outcome with sent status
    const { data: existingOutcome } = await supabase
      .from('outcomes')
      .select('id')
      .eq('message_id', messageId)
      .single();

    if (existingOutcome) {
      await supabase
        .from('outcomes')
        .update({
          final_action: 'reply',
          final_reply_text: body,
          status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('message_id', messageId);
    } else {
      await supabase
        .from('outcomes')
        .insert([{
          message_id: messageId,
          final_action: 'reply',
          final_reply_text: body,
          status: 'sent',
        }]);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        gmailMessageId: sendResult.id,
        threadId: sendResult.threadId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send email error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

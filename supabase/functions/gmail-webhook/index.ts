import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

async function refreshTokenIfNeeded(
  supabase: any,
  account: any,
  userId: string
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(account.token_expires_at);

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

async function fetchAndStoreMessages(
  supabase: any,
  accessToken: string,
  userId: string,
  messageIds: string[]
): Promise<number> {
  let imported = 0;

  for (const msgId of messageIds) {
    // Fetch full message details
    const msgDetailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!msgDetailResponse.ok) continue;

    const msgDetail = await msgDetailResponse.json();
    
    // Check if it's in PRIMARY category
    const labelIds = msgDetail.labelIds || [];
    if (!labelIds.includes('INBOX') || 
        labelIds.includes('CATEGORY_PROMOTIONS') || 
        labelIds.includes('CATEGORY_SOCIAL') || 
        labelIds.includes('CATEGORY_UPDATES')) {
      continue;
    }

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

    // Upsert message (insert or skip if duplicate)
    const { error: insertError } = await supabase
      .from('messages')
      .upsert({
        user_id: userId,
        provider_message_id: msgId,
        subject,
        from_email: fromEmail,
        from_name: fromName,
        body_snippet: bodySnippet,
        body_full: bodySnippet,
        received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        is_demo: false,
        processed: false,
      }, {
        onConflict: 'user_id,provider_message_id',
        ignoreDuplicates: true,
      });

    if (!insertError) {
      imported++;
    }
  }

  return imported;
}

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook token
    const webhookToken = req.headers.get('x-webhook-token') || 
                         new URL(req.url).searchParams.get('token');
    const expectedToken = Deno.env.get('GMAIL_WEBHOOK_TOKEN');

    if (!expectedToken || webhookToken !== expectedToken) {
      console.error('Invalid webhook token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse Pub/Sub message
    const body: PubSubMessage = await req.json();
    const messageData = body.message?.data;

    if (!messageData) {
      console.log('No message data in request');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decode base64 message
    const decodedData = atob(messageData);
    const notification: GmailNotification = JSON.parse(decodedData);

    console.log('Gmail notification:', notification);

    // Find user by Gmail email
    const { data: watchState, error: watchError } = await supabase
      .from('gmail_watch_state')
      .select('*')
      .eq('gmail_email', notification.emailAddress)
      .single();

    if (watchError || !watchState) {
      console.error('No watch state found for email:', notification.emailAddress);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = watchState.user_id;

    // Get connected account
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'gmail')
      .single();

    if (accountError || !account || account.status !== 'connected') {
      console.error('Gmail not connected for user:', userId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, account, userId);
    if (!accessToken) {
      console.error('Failed to get access token');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get history since last known historyId
    const startHistoryId = watchState.history_id;
    const historyResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const historyData = await historyResponse.json();

    if (historyData.error) {
      // History ID expired or invalid - need full sync
      if (historyData.error.code === 404 || historyData.error.code === 400) {
        console.log('History expired, triggering full sync');
        
        // Do a quick sync of recent messages
        const messagesResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread%20category:primary&maxResults=10`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const messagesData = await messagesResponse.json();
        const messages = messagesData.messages || [];
        const messageIds = messages.map((m: any) => m.id);

        if (messageIds.length > 0) {
          await fetchAndStoreMessages(supabase, accessToken, userId, messageIds);
        }

        // Update history ID to the new one
        await supabase
          .from('gmail_watch_state')
          .update({
            history_id: notification.historyId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        return new Response(JSON.stringify({ success: true, fullSync: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.error('History API error:', historyData.error);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract new message IDs from history
    const history = historyData.history || [];
    const newMessageIds: string[] = [];

    for (const record of history) {
      const messagesAdded = record.messagesAdded || [];
      for (const added of messagesAdded) {
        if (added.message?.id) {
          newMessageIds.push(added.message.id);
        }
      }
    }

    console.log(`Found ${newMessageIds.length} new messages`);

    // Fetch and store new messages
    let imported = 0;
    if (newMessageIds.length > 0) {
      imported = await fetchAndStoreMessages(supabase, accessToken, userId, newMessageIds);
    }

    // Update history ID
    const newHistoryId = historyData.historyId || notification.historyId;
    await supabase
      .from('gmail_watch_state')
      .update({
        history_id: newHistoryId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    console.log(`Imported ${imported} messages, updated historyId to ${newHistoryId}`);

    return new Response(
      JSON.stringify({ success: true, imported }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ success: true, error: 'Internal error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

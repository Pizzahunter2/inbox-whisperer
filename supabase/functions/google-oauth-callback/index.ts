import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function setupGmailWatch(accessToken: string, supabaseUrl: string): Promise<{ historyId: string; expiration: string } | null> {
  try {
    const topic = Deno.env.get('GMAIL_PUBSUB_TOPIC');
    if (!topic) {
      console.log('GMAIL_PUBSUB_TOPIC not configured, skipping watch setup');
      return null;
    }

    const watchResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName: topic,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      }),
    });

    const watchData = await watchResponse.json();

    if (watchData.error) {
      console.error('Gmail watch error:', watchData.error);
      return null;
    }

    console.log('Gmail watch set up:', watchData);

    return {
      historyId: watchData.historyId,
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
    };
  } catch (error) {
    console.error('Failed to set up Gmail watch:', error);
    return null;
  }
}

async function getGmailEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const profile = await response.json();
    return profile.emailAddress || null;
  } catch (error) {
    console.error('Failed to get Gmail email:', error);
    return null;
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(`<html><body><script>window.close();</script>OAuth error: ${error}</body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!code || !state) {
      return new Response('<html><body><script>window.close();</script>Missing code or state</body></html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Decode state to get user ID and redirect URL
    let stateData: { userId: string; redirectUrl: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response('<html><body><script>window.close();</script>Invalid state</body></html>', {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return new Response(`<html><body><script>window.close();</script>Token error: ${tokenData.error}</body></html>`, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Store tokens in connected_accounts using service role
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Update or insert connected account for gmail
    const { error: gmailError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: stateData.userId,
        provider: 'gmail',
        access_token_encrypted: tokenData.access_token,
        refresh_token_encrypted: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (gmailError) {
      console.error('Gmail account update error:', gmailError);
    }

    // Also update calendar status
    const { error: calendarError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: stateData.userId,
        provider: 'google_calendar',
        access_token_encrypted: tokenData.access_token,
        refresh_token_encrypted: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (calendarError) {
      console.error('Calendar account update error:', calendarError);
    }

    // Get Gmail email for webhook mapping
    const gmailEmail = await getGmailEmail(tokenData.access_token);

    // Set up Gmail Watch for push notifications
    const watchResult = await setupGmailWatch(tokenData.access_token, supabaseUrl);

    if (watchResult && gmailEmail) {
      // Store watch state
      const { error: watchError } = await supabase
        .from('gmail_watch_state')
        .upsert({
          user_id: stateData.userId,
          history_id: watchResult.historyId,
          expiration: watchResult.expiration,
          gmail_email: gmailEmail,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (watchError) {
        console.error('Watch state save error:', watchError);
      } else {
        console.log('Gmail watch state saved for', gmailEmail);
      }
    }

    // Redirect back to the app with the full URL
    const baseUrl = stateData.redirectUrl 
      ? new URL(stateData.redirectUrl).origin 
      : 'https://id-preview--99e9d33a-16dd-4bb0-80bd-dc1135888b13.lovable.app';
    const redirectUrl = `${baseUrl}/settings`;
    
    // Return a styled success page with proper popup/redirect handling
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Connected Successfully</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
            }
            .card {
              background: white;
              border-radius: 16px;
              padding: 48px;
              text-align: center;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              max-width: 400px;
              width: 100%;
            }
            .icon {
              width: 64px;
              height: 64px;
              background: #10b981;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
            }
            .icon svg {
              width: 32px;
              height: 32px;
              color: white;
            }
            h1 {
              color: #1f2937;
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 12px;
            }
            p {
              color: #6b7280;
              font-size: 16px;
              line-height: 1.5;
            }
            .spinner {
              margin-top: 24px;
              width: 24px;
              height: 24px;
              border: 3px solid #e5e7eb;
              border-top-color: #667eea;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-left: auto;
              margin-right: auto;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1>Successfully Connected!</h1>
            <p>Your Gmail and Calendar accounts have been linked. Real-time sync is now active. Redirecting you back to settings...</p>
            <div class="spinner"></div>
          </div>
          <script>
            (function() {
              const isPopup = window.opener && window.opener !== window;
              
              if (isPopup) {
                // Send message to opener and close popup
                window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                // Redirect in same window
                setTimeout(() => {
                  window.location.href = '${redirectUrl}';
                }, 1500);
              }
            })();
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error: unknown) {
    console.error('Callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`<html><body><script>window.close();</script>Error: ${message}</body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

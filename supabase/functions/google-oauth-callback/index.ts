import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Redirect back to the app
    const redirectUrl = stateData.redirectUrl || '/settings';
    
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
            <p>Your Gmail and Calendar accounts have been linked. Redirecting you back to settings...</p>
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

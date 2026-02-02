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
    
    return new Response(
      `<html>
        <body>
          <script>
            window.opener?.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS' }, '*');
            window.location.href = '${redirectUrl}';
          </script>
          <p>Connected successfully! Redirecting...</p>
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

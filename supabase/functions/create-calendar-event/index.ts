import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const body = await req.json();
    const {
      messageId,
      title,
      description,
      attendeeEmail,
      timezone = "America/New_York",
    } = body;

    // Accept both legacy and required param names
    const startTime = body.startTime ?? body.selectedStart;
    const endTime = body.endTime ?? body.selectedEnd;

    if (!title || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: title, startTime, endTime',
          details: `Received: title=${!!title}, startTime=${!!startTime}, endTime=${!!endTime}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that startTime and endTime are valid ISO strings
    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid date format for startTime or endTime',
          details: `startTime="${startTime}", endTime="${endTime}" - must be valid ISO date strings`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get connected Gmail account (same tokens work for Calendar with correct scopes)
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'gmail')
      .single();

    if (accountError || !account || account.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Google account not connected. Please connect your Google account in Settings.' }),
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

    // Create event payload
    const eventPayload: any = {
      summary: title,
      description: description || '',
      start: {
        dateTime: startTime,
        timeZone: timezone,
      },
      end: {
        dateTime: endTime,
        timeZone: timezone,
      },
      reminders: {
        useDefault: true,
      },
    };

    // Add attendee if provided
    if (attendeeEmail) {
      eventPayload.attendees = [{ email: attendeeEmail }];
      eventPayload.sendUpdates = 'all'; // Send email invitations
    }

    // Create event via Google Calendar API
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );

    const eventResult = await calendarResponse.json();

    if (eventResult.error) {
      console.error('Calendar API error:', eventResult.error);
      
      if (eventResult.error.code === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'Permission denied. Please reconnect your Google account with calendar permissions.',
            needsReconnect: true 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: eventResult.error.message || 'Failed to create calendar event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If messageId provided, update the proposal with calendar event info
    if (messageId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('suggested_time_slots')
        .eq('message_id', messageId)
        .single();

      if (proposal) {
        const updatedSlots = proposal.suggested_time_slots || [];
        // Add calendar event info to the slots
        const calendarInfo = {
          eventId: eventResult.id,
          eventLink: eventResult.htmlLink,
          createdAt: new Date().toISOString(),
        };

        await supabase
          .from('proposals')
          .update({
            suggested_time_slots: [...updatedSlots, { calendarEvent: calendarInfo }],
          })
          .eq('message_id', messageId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: eventResult.id,
        eventLink: eventResult.htmlLink,
        eventStart: eventResult.start,
        eventEnd: eventResult.end,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create calendar event error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create calendar event' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
      .eq('provider', 'google_calendar');

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

    const { durationMinutes = 30 } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user profile for working hours
    const { data: profile } = await supabase
      .from('profiles')
      .select('working_hours_start, working_hours_end, meeting_min_notice_hours, timezone')
      .eq('user_id', user.id)
      .single();

    const workStart = profile?.working_hours_start || '09:00';
    const workEnd = profile?.working_hours_end || '17:00';
    const minNotice = profile?.meeting_min_notice_hours || 24;

    // Get connected Calendar account
    const { data: account, error: accountError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .single();

    if (accountError || !account || account.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await refreshTokenIfNeeded(supabase, account, user.id);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to refresh token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get events for the next 7 days
    const now = new Date();
    const minTime = new Date(now.getTime() + minNotice * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${minTime.toISOString()}&timeMax=${maxTime.toISOString()}&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const eventsData = await eventsResponse.json();

    if (eventsData.error) {
      console.error('Calendar API error:', eventsData.error);
      return new Response(
        JSON.stringify({ error: 'Calendar API error', details: eventsData.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const busySlots = (eventsData.items || [])
      .filter((e: any) => e.start?.dateTime && e.end?.dateTime)
      .map((e: any) => ({
        start: new Date(e.start.dateTime),
        end: new Date(e.end.dateTime),
      }));

    // Find available slots
    const suggestedSlots: { start: string; end: string }[] = [];
    const duration = durationMinutes * 60 * 1000;

    // Parse working hours
    const [startHour, startMin] = workStart.split(':').map(Number);
    const [endHour, endMin] = workEnd.split(':').map(Number);

    // Check each day
    for (let dayOffset = 0; dayOffset < 7 && suggestedSlots.length < 3; dayOffset++) {
      const checkDate = new Date(minTime);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      
      // Skip weekends
      if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;

      // Set to start of working hours
      const dayStart = new Date(checkDate);
      dayStart.setHours(startHour, startMin, 0, 0);

      const dayEnd = new Date(checkDate);
      dayEnd.setHours(endHour, endMin, 0, 0);

      // Start from minTime if it's today and after working hours start
      let slotStart = dayStart;
      if (dayOffset === 0 && minTime > dayStart) {
        // Round up to next 30 min
        slotStart = new Date(minTime);
        const mins = slotStart.getMinutes();
        if (mins % 30 !== 0) {
          slotStart.setMinutes(mins + (30 - (mins % 30)), 0, 0);
        }
      }

      // Find slots on this day
      while (slotStart.getTime() + duration <= dayEnd.getTime() && suggestedSlots.length < 3) {
        const slotEnd = new Date(slotStart.getTime() + duration);

        // Check if slot conflicts with any busy time
        const hasConflict = busySlots.some(
          (busy: { start: Date; end: Date }) =>
            (slotStart >= busy.start && slotStart < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (slotStart <= busy.start && slotEnd >= busy.end)
        );

        if (!hasConflict) {
          suggestedSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
          // Move to after this slot
          slotStart = slotEnd;
        } else {
          // Find the end of the conflicting busy slot
          const conflictingSlot = busySlots.find(
            (busy: { start: Date; end: Date }) =>
              (slotStart >= busy.start && slotStart < busy.end)
          );
          if (conflictingSlot) {
            slotStart = new Date(conflictingSlot.end);
            // Round up to next 30 min
            const mins = slotStart.getMinutes();
            if (mins % 30 !== 0) {
              slotStart.setMinutes(mins + (30 - (mins % 30)), 0, 0);
            }
          } else {
            slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        slots: suggestedSlots,
        workingHours: { start: workStart, end: workEnd },
        minNoticeHours: minNotice,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Suggest times error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to suggest meeting times' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

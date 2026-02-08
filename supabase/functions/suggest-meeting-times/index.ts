import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (tokenData.error) return null;

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
      .eq('provider', 'google_calendar');

    return tokenData.access_token;
  }

  return await decryptTokenSafe(account.access_token_encrypted);
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

    const { durationMinutes = 60 } = await req.json().catch(() => ({}));
    
    // Minimum gap between suggested slots (2 hours) to spread them out
    const slotGapMs = 2 * 60 * 60 * 1000;

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
    const userTimezone = profile?.timezone || 'America/New_York';

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
        JSON.stringify({ error: 'Failed to fetch calendar data. Please try again or reconnect your account.' }),
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

    // Helper to get timezone offset for a given date
    // This creates a date string in the user's timezone and parses it to get the offset
    function getDateInTimezone(date: Date, tz: string): Date {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
      return new Date(
        parseInt(get('year')),
        parseInt(get('month')) - 1,
        parseInt(get('day')),
        parseInt(get('hour')),
        parseInt(get('minute')),
        parseInt(get('second'))
      );
    }

    // Helper to create a date at specific time in user's timezone
    function createTimeInTimezone(baseDate: Date, hour: number, minute: number, tz: string): Date {
      // Get the date components in user's timezone
      const tzDate = getDateInTimezone(baseDate, tz);
      
      // Create a new date with the desired time in user's timezone
      const targetLocal = new Date(tzDate.getFullYear(), tzDate.getMonth(), tzDate.getDate(), hour, minute, 0, 0);
      
      // Now we need to convert this back to UTC
      // Get the offset by comparing what time it is in the timezone vs UTC
      const utcDate = new Date(baseDate.toISOString());
      const tzDateMs = tzDate.getTime();
      const utcMs = new Date(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate(), utcDate.getHours(), utcDate.getMinutes(), utcDate.getSeconds()).getTime();
      const offsetMs = tzDateMs - utcMs;
      
      // For the target time, we need to subtract the offset to get UTC
      // Actually, let's use a simpler approach: format and parse
      const year = tzDate.getFullYear();
      const month = tzDate.getMonth();
      const day = tzDate.getDate();
      
      // Create the desired local time and then find its UTC equivalent
      // We'll use the Intl API to help us
      const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      
      // Parse this as if it's in the user's timezone
      // We need to figure out the UTC offset for this specific datetime
      const tempDate = new Date(isoString + 'Z'); // Parse as UTC first
      const tempTzDate = getDateInTimezone(tempDate, tz);
      const hourDiff = tempTzDate.getHours() - tempDate.getUTCHours();
      const minDiff = tempTzDate.getMinutes() - tempDate.getUTCMinutes();
      const totalOffsetMs = (hourDiff * 60 + minDiff) * 60 * 1000;
      
      // The actual UTC time is the local time minus the offset
      return new Date(new Date(isoString + 'Z').getTime() - totalOffsetMs);
    }

    // Check each day
    for (let dayOffset = 0; dayOffset < 7 && suggestedSlots.length < 3; dayOffset++) {
      const checkDate = new Date(minTime);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      
      // Skip weekends (check in user's timezone)
      const tzCheckDate = getDateInTimezone(checkDate, userTimezone);
      if (tzCheckDate.getDay() === 0 || tzCheckDate.getDay() === 6) continue;

      // Set to start of working hours in user's timezone
      const dayStart = createTimeInTimezone(checkDate, startHour, startMin, userTimezone);
      const dayEnd = createTimeInTimezone(checkDate, endHour, endMin, userTimezone);

      // Start from minTime if it's after working hours start
      let slotStart = dayStart;
      if (minTime > dayStart) {
        slotStart = new Date(minTime);
        // Round up to next 30 min
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
          // Move past this slot plus the gap to spread out suggestions
          slotStart = new Date(slotEnd.getTime() + slotGapMs);
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

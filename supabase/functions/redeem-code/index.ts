import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REDEEM_CODES: Record<string, { trialDays: number; description: string }> = {
  prosubkey: { trialDays: 30, description: "1 month free Pro access" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { code } = await req.json();
    if (!code) throw new Error("Missing code");

    const normalizedCode = code.trim().toLowerCase();
    const redeemConfig = REDEEM_CODES[normalizedCode];

    if (!redeemConfig) {
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check if user already redeemed this code
    const { data: existing } = await supabaseClient
      .from("redeemed_codes")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("code", normalizedCode)
      .maybeSingle();

    if (existing) {
      const expiresAt = new Date(existing.expires_at);
      if (expiresAt > new Date()) {
        return new Response(JSON.stringify({ error: "You have already redeemed this code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + redeemConfig.trialDays);

    const { error: insertError } = await supabaseClient
      .from("redeemed_codes")
      .upsert({
        user_id: user.id,
        code: normalizedCode,
        description: redeemConfig.description,
        granted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "user_id,code" });

    if (insertError) throw new Error(`Failed to redeem: ${insertError.message}`);

    return new Response(JSON.stringify({
      success: true,
      description: redeemConfig.description,
      expires_at: expiresAt.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

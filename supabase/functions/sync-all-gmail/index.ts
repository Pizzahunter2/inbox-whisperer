import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all connected Gmail accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("connected_accounts")
      .select("user_id")
      .eq("provider", "gmail")
      .eq("status", "connected");

    if (accountsError) {
      console.error("Error fetching accounts:", accountsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch accounts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "No connected accounts" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${accounts.length} connected Gmail accounts`);

    let successCount = 0;
    let errorCount = 0;

    // Call sync-gmail for each user by impersonating their auth
    for (const account of accounts) {
      try {
        // Call the sync-gmail function using the service role
        // We need to generate a token for the user or call the Gmail API directly
        // Instead, we'll invoke the sync-gmail function with a special header
        const response = await fetch(
          `${supabaseUrl}/functions/v1/sync-gmail`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
              "x-sync-user-id": account.user_id,
            },
          }
        );

        const result = await response.json();
        if (response.ok && !result.error) {
          console.log(`Synced user ${account.user_id}: imported=${result.imported}, skipped=${result.skipped}`);
          successCount++;
        } else {
          console.error(`Failed to sync user ${account.user_id}:`, result.error);
          errorCount++;
        }
      } catch (err) {
        console.error(`Error syncing user ${account.user_id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_accounts: accounts.length,
        synced: successCount,
        errors: errorCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync-all error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

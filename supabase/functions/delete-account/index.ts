import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role to delete user data and auth account
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete user data from all tables (RLS won't apply with service role)
    await adminClient.from("outcomes").delete().eq("message_id", 
      adminClient.from("messages").select("id").eq("user_id", userId)
    );
    
    // Delete in correct order to respect foreign keys
    const { data: messageIds } = await adminClient
      .from("messages")
      .select("id")
      .eq("user_id", userId);

    if (messageIds && messageIds.length > 0) {
      const ids = messageIds.map((m: any) => m.id);
      await adminClient.from("outcomes").delete().in("message_id", ids);
      await adminClient.from("proposals").delete().in("message_id", ids);
      await adminClient.from("classifications").delete().in("message_id", ids);
    }

    await adminClient.from("messages").delete().eq("user_id", userId);
    await adminClient.from("chat_conversations").delete().eq("user_id", userId);
    await adminClient.from("gmail_watch_state").delete().eq("user_id", userId);
    await adminClient.from("connected_accounts").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch user's recent emails for context (last 100, with classifications & proposals)
    const { data: emailData } = await supabase
      .from("messages")
      .select(`
        id, subject, from_email, from_name, body_snippet, body_full, received_at,
        classifications (category, confidence, extracted_entities),
        proposals (summary, proposed_action, suggested_reply),
        outcomes (final_action, status)
      `)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(100);

    const emails = emailData || [];

    // Build a compact inbox summary for the system prompt
    const inboxSummary = emails.map((e: any, i: number) => {
      const classification = e.classifications?.[0] || e.classifications;
      const proposal = e.proposals?.[0] || e.proposals;
      const outcome = e.outcomes?.[0] || e.outcomes;
      return [
        `[${i + 1}] ID: ${e.id}`,
        `  From: ${e.from_name || ""} <${e.from_email}>`,
        `  Subject: ${e.subject}`,
        `  Date: ${e.received_at}`,
        classification ? `  Category: ${classification.category} (${classification.confidence})` : null,
        classification?.extracted_entities ? `  Entities: ${JSON.stringify(classification.extracted_entities)}` : null,
        proposal ? `  AI Summary: ${proposal.summary}` : null,
        outcome ? `  Action taken: ${outcome.final_action} (${outcome.status})` : null,
        e.body_snippet ? `  Preview: ${e.body_snippet.slice(0, 200)}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const systemPrompt = `You are an AI inbox assistant for the email management app "Inbox Middleman". You help the user understand and manage their email inbox.

You have access to the user's ${emails.length} most recent emails below. Use this data to answer questions, find information, summarize threads, identify patterns, and help with inbox management.

When referring to specific emails, mention the sender and subject line so the user can identify them.

If the user asks you to take an action (archive, reply, etc.), explain what you would do but note that direct actions are coming soon. For now, guide them to the dashboard to perform actions.

Be concise, helpful, and conversational. Format your responses with markdown when helpful.

--- USER'S INBOX ---
${inboxSummary || "No emails found in inbox."}
--- END INBOX ---`;

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat inbox error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

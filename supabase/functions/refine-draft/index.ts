import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instruction, currentDraft, meetingSlots } = await req.json();

    if (!instruction && !currentDraft) {
      return new Response(JSON.stringify({ error: "instruction or currentDraft required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let slotsContext = "";
    if (meetingSlots && meetingSlots.length > 0) {
      slotsContext = `\n\nThe user has the following available meeting time slots from their calendar. Include these in the email body as suggested times:\n${meetingSlots.map((s: any, i: number) => `${i + 1}. ${s.label}`).join("\n")}`;
    }

    const systemPrompt = `You are an email drafting assistant. You help compose and refine email drafts.
Your response must be ONLY a valid JSON object with these fields:
- "to": recipient email address
- "subject": email subject line
- "body": the full email body text

Do not include any text outside the JSON object. Do not use markdown code blocks.
If the current draft has values, preserve them unless the user's instruction says otherwise.${slotsContext}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (currentDraft) {
      messages.push({
        role: "user",
        content: `Current draft:\nTo: ${currentDraft.to || ""}\nSubject: ${currentDraft.subject || ""}\nBody:\n${currentDraft.body || ""}\n\nInstruction: ${instruction || "Improve this draft."}`,
      });
    } else {
      messages.push({
        role: "user",
        content: instruction,
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Parse the JSON from the AI response
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const draft = JSON.parse(jsonStr);
      return new Response(JSON.stringify({ success: true, draft }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // If JSON parsing fails, return the raw content
      return new Response(JSON.stringify({ success: true, draft: { to: "", subject: "", body: content } }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("refine-draft error:", error);
    return new Response(JSON.stringify({ error: "Failed to refine draft" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

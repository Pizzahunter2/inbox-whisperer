import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailData {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_snippet: string | null;
  body_full: string | null;
}

interface Profile {
  reply_tone: string;
  signature: string;
  working_hours_start: string;
  working_hours_end: string;
  meeting_default_duration: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();
    
    if (!messageId) {
      throw new Error("messageId is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      throw new Error("Message not found");
    }

    // Fetch user profile for tone and signature
    const { data: profile } = await supabase
      .from("profiles")
      .select("reply_tone, signature, working_hours_start, working_hours_end, meeting_default_duration")
      .eq("user_id", message.user_id)
      .single();

    const emailContent = message.body_full || message.body_snippet || "";
    const userTone = profile?.reply_tone || "neutral";
    const userSignature = profile?.signature || "";
    const workStart = profile?.working_hours_start || "09:00";
    const workEnd = profile?.working_hours_end || "17:00";
    const meetingDuration = profile?.meeting_default_duration || 30;

    // Call AI to analyze the email
    const systemPrompt = `You are an AI email assistant. Analyze emails and provide structured responses.

Your task is to:
1. Summarize the email in 1-2 sentences
2. Categorize it into one of: meeting_request, action_needed, fyi, newsletter, other
3. Determine confidence level: high, medium, or low
4. Extract key entities like dates, times, deadlines, locations
5. Generate a professional reply in a ${userTone} tone

User's signature to include in replies:
${userSignature}`;

    const userPrompt = `Analyze this email and respond with a JSON object:

From: ${message.from_name || "Unknown"} <${message.from_email}>
Subject: ${message.subject}
Body:
${emailContent}

Respond ONLY with valid JSON in this exact format:
{
  "summary": "1-2 sentence summary",
  "category": "meeting_request|action_needed|fyi|newsletter|other",
  "confidence": "high|medium|low",
  "extracted_entities": {
    "date": "extracted date if any",
    "time": "extracted time if any",
    "deadline": "deadline if mentioned",
    "location": "meeting location if any",
    "duration": "meeting duration if mentioned"
  },
  "proposed_action": "reply|draft|schedule|archive|mark_done",
  "suggested_reply": "Professional reply text based on the ${userTone} tone"
}

IMPORTANT: Do NOT include suggested_time_slots in your response. 
The reply should acknowledge the meeting request but not propose specific times (we will add real calendar availability separately).
Ensure the reply is complete, professional, and ready to send.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error("Failed to analyze email");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Provide default values if parsing fails
      analysis = {
        summary: "Email received - AI analysis unavailable",
        category: "other",
        confidence: "low",
        extracted_entities: {},
        proposed_action: "reply",
        suggested_reply: `Thank you for your email. I will review and get back to you.\n\n${userSignature}`,
      };
    }

    // If it's a meeting request, get actual calendar availability
    let suggestedTimeSlots: any[] = [];
    if (analysis.category === "meeting_request") {
      try {
        // Get user's JWT from the original request to call suggest-meeting-times as them
        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
          const suggestResponse = await fetch(
            `${supabaseUrl}/functions/v1/suggest-meeting-times`,
            {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ durationMinutes: meetingDuration }),
            }
          );

          if (suggestResponse.ok) {
            const suggestData = await suggestResponse.json();
            if (suggestData.slots && suggestData.slots.length > 0) {
              suggestedTimeSlots = suggestData.slots;
              console.log("Got calendar-based time slots:", suggestedTimeSlots);
            }
          } else {
            console.log("suggest-meeting-times returned non-OK:", await suggestResponse.text());
          }
        }
      } catch (calendarError) {
        console.error("Failed to get calendar availability:", calendarError);
        // Continue without calendar slots - user can still reply manually
      }
    }

    // Store classification
    const { error: classError } = await supabase
      .from("classifications")
      .upsert({
        message_id: messageId,
        category: analysis.category,
        confidence: analysis.confidence,
        extracted_entities: analysis.extracted_entities || {},
      }, { onConflict: "message_id" });

    if (classError) {
      console.error("Classification error:", classError);
    }

    // Store proposal
    const { error: propError } = await supabase
      .from("proposals")
      .upsert({
        message_id: messageId,
        proposed_action: analysis.proposed_action || "reply",
        summary: analysis.summary,
        suggested_reply: analysis.suggested_reply,
        suggested_time_slots: suggestedTimeSlots,
      }, { onConflict: "message_id" });

    if (propError) {
      console.error("Proposal error:", propError);
    }

    // Mark message as processed
    await supabase
      .from("messages")
      .update({ processed: true })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Process email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
  auto_add_ticket_events: boolean;
}

interface ImageAttachment {
  mimeType: string;
  base64Data: string;
  filename: string;
}

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

async function refreshGmailToken(supabase: any, account: any, userId: string): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(account.token_expires_at);

  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshToken = await decryptTokenSafe(account.refresh_token_encrypted);
    if (!refreshToken) return null;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await response.json();
    if (tokenData.error) {
      console.error("Token refresh error:", tokenData);
      return null;
    }

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const encryptedAccess = await encryptToken(tokenData.access_token);

    await supabase
      .from("connected_accounts")
      .update({
        access_token_encrypted: encryptedAccess,
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "gmail");

    return tokenData.access_token;
  }

  return await decryptTokenSafe(account.access_token_encrypted);
}

async function fetchImageAttachments(
  providerMessageId: string,
  accessToken: string,
  maxImages = 5,
  maxSizeBytes = 5 * 1024 * 1024
): Promise<ImageAttachment[]> {
  const images: ImageAttachment[] = [];

  try {
    // Fetch message metadata to find attachments
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!msgResponse.ok) {
      console.error("Failed to fetch Gmail message for attachments:", msgResponse.status);
      return images;
    }

    const msgData = await msgResponse.json();

    // Recursively find image parts
    const imageParts: { attachmentId: string; mimeType: string; filename: string; size: number }[] = [];

    function findImageParts(part: any) {
      const mime = part.mimeType || "";
      if (
        mime.startsWith("image/") &&
        part.body?.attachmentId &&
        (part.body?.size || 0) <= maxSizeBytes
      ) {
        imageParts.push({
          attachmentId: part.body.attachmentId,
          mimeType: mime,
          filename: part.filename || "image",
          size: part.body.size || 0,
        });
      }
      if (part.parts) {
        for (const child of part.parts) findImageParts(child);
      }
    }

    findImageParts(msgData.payload);

    // Download up to maxImages attachments
    for (const imgPart of imageParts.slice(0, maxImages)) {
      try {
        const attResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}/attachments/${imgPart.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!attResponse.ok) continue;

        const attData = await attResponse.json();
        if (attData.data) {
          // Gmail returns base64url-encoded data, convert to standard base64
          const base64 = attData.data.replace(/-/g, "+").replace(/_/g, "/");
          images.push({
            mimeType: imgPart.mimeType,
            base64Data: base64,
            filename: imgPart.filename,
          });
        }
      } catch (e) {
        console.error("Failed to download attachment:", imgPart.filename, e);
      }
    }
  } catch (e) {
    console.error("Error fetching image attachments:", e);
  }

  return images;
}

function buildAIMessages(
  systemPrompt: string,
  userPrompt: string,
  images: ImageAttachment[]
): any[] {
  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (images.length === 0) {
    messages.push({ role: "user", content: userPrompt });
  } else {
    // Build multimodal content array
    const contentParts: any[] = [{ type: "text", text: userPrompt }];

    for (const img of images) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64Data}`,
        },
      });
      contentParts.push({
        type: "text",
        text: `[Attached image: ${img.filename}]`,
      });
    }

    messages.push({ role: "user", content: contentParts });
  }

  return messages;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: "messageId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!uuidRegex.test(messageId)) {
      return new Response(
        JSON.stringify({ error: "Invalid messageId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (message.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile for tone and signature
    const { data: profile } = await supabase
      .from("profiles")
      .select("reply_tone, signature, working_hours_start, working_hours_end, meeting_default_duration, auto_add_ticket_events")
      .eq("user_id", message.user_id)
      .single();

    const emailContent = message.body_full || message.body_snippet || "";
    const userTone = profile?.reply_tone || "neutral";
    const userSignature = profile?.signature || "";
    const workStart = profile?.working_hours_start || "09:00";
    const workEnd = profile?.working_hours_end || "17:00";
    const meetingDuration = profile?.meeting_default_duration || 60;
    const autoAddTicketEvents = profile?.auto_add_ticket_events ?? false;

    // Fetch image attachments from Gmail if we have a provider message ID
    let imageAttachments: ImageAttachment[] = [];
    if (message.provider_message_id) {
      try {
        const { data: account } = await supabase
          .from("connected_accounts")
          .select("*")
          .eq("user_id", message.user_id)
          .eq("provider", "gmail")
          .single();

        if (account && account.status === "connected") {
          const accessToken = await refreshGmailToken(supabase, account, message.user_id);
          if (accessToken) {
            imageAttachments = await fetchImageAttachments(message.provider_message_id, accessToken);
            if (imageAttachments.length > 0) {
              console.log(`Found ${imageAttachments.length} image attachment(s) for analysis`);
            }
          }
        }
      } catch (imgError) {
        console.error("Failed to fetch image attachments:", imgError);
        // Continue without images
      }
    }

    // Build system prompt - mention images if present
    const imageContext = imageAttachments.length > 0
      ? `\n\nThis email contains ${imageAttachments.length} attached image(s). Analyze them carefully and incorporate any relevant information (text in images, charts, receipts, tickets, screenshots, etc.) into your summary and response.`
      : "";

    const systemPrompt = `You are an AI email assistant. Analyze emails and provide structured responses.

Your task is to:
1. Summarize the email in 1-2 sentences
2. Categorize it into one of: meeting_request, action_needed, fyi, newsletter, other
3. Determine confidence level: high, medium, or low
4. Extract key entities like dates, times, deadlines, locations
5. Generate a professional reply in a ${userTone} tone
6. Detect if this is a ticket confirmation email (flight, train, bus, concert, event, hotel, etc.) and extract event details${imageContext}

User's signature to include in replies:
${userSignature}`;

    const userPrompt = `Analyze this email and respond with a JSON object:

From: ${message.from_name || "Unknown"} <${message.from_email}>
Subject: ${message.subject}
Body:
${emailContent}
${imageAttachments.length > 0 ? `\n[This email has ${imageAttachments.length} image attachment(s) included below for your analysis]` : ""}

Respond ONLY with valid JSON in this exact format:
{
  "summary": "1-2 sentence summary",
  "category": "meeting_request|action_needed|fyi|newsletter|other",
  "confidence": "high|medium|low",
  "extracted_entities": {
    "date": "extracted date if any",
    "time": "extracted departure/start time if any (e.g. '12:07 PM'). IMPORTANT: Always extract the specific start time from the email - for flights use the departure time, for events use the event start time. Never leave this null or 'Not specified' if a time is mentioned in the email.",
    "deadline": "deadline if mentioned",
    "location": "meeting location if any",
    "duration": "duration if mentioned (e.g. '1h 47m', '30 min', '2 hours')",
    "image_content": "brief description of what was found in any attached images, or null if no images"
  },
  "proposed_action": "reply|draft|schedule|archive|mark_done",
  "suggested_reply": "Professional reply text based on the ${userTone} tone",
  "is_ticket_confirmation": true or false,
  "ticket_event": {
    "title": "e.g. Flight AA1234 JFK → LAX",
    "start_datetime": "ISO 8601 datetime string of departure/event start",
    "end_datetime": "ISO 8601 datetime string of arrival/event end",
    "location": "departure airport, venue, etc.",
    "description": "key details: confirmation number, seat, gate, etc."
  }
}

If the email is NOT a ticket/booking confirmation, set "is_ticket_confirmation" to false and "ticket_event" to null.
IMPORTANT: Do NOT include suggested_time_slots in your response. 
The reply should acknowledge the meeting request but not propose specific times (we will add real calendar availability separately).
Ensure the reply is complete, professional, and ready to send.`;

    // Build messages array (multimodal if images present)
    const aiMessages = buildAIMessages(systemPrompt, userPrompt, imageAttachments);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
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
      throw new Error("Failed to analyze email. Please try again later.");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
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
      }
    }

    // Store classification
    const { error: classError } = await supabase
      .from("classifications")
      .upsert({
        message_id: messageId,
        category: analysis.category,
        confidence: analysis.confidence,
        extracted_entities: {
          ...(analysis.extracted_entities || {}),
          ...(analysis.is_ticket_confirmation && analysis.ticket_event ? {
            ticket_start_datetime: analysis.ticket_event.start_datetime,
            ticket_end_datetime: analysis.ticket_event.end_datetime,
          } : {}),
          ...(imageAttachments.length > 0 ? {
            has_image_attachments: true,
            image_count: imageAttachments.length,
          } : {}),
        },
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

    // Auto-create calendar event for ticket confirmations
    let ticketEventCreated = false;
    if (autoAddTicketEvents && analysis.is_ticket_confirmation && analysis.ticket_event) {
      try {
        const authHeader = req.headers.get("Authorization");
        if (authHeader && analysis.ticket_event.start_datetime && analysis.ticket_event.end_datetime) {
          const calendarResponse = await fetch(
            `${supabaseUrl}/functions/v1/create-calendar-event`,
            {
              method: "POST",
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messageId,
                title: analysis.ticket_event.title || `Ticket: ${message.subject}`,
                startTime: analysis.ticket_event.start_datetime,
                endTime: analysis.ticket_event.end_datetime,
                description: analysis.ticket_event.description || "",
              }),
            }
          );

          if (calendarResponse.ok) {
            ticketEventCreated = true;
            console.log("Auto-created calendar event for ticket confirmation");
          } else {
            console.error("Failed to auto-create ticket calendar event:", await calendarResponse.text());
          }
        }
      } catch (calError) {
        console.error("Error auto-creating ticket calendar event:", calError);
      }
    }

    // Mark message as processed
    await supabase
      .from("messages")
      .update({ processed: true })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        ticketEventCreated,
        imagesAnalyzed: imageAttachments.length,
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

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { EmailQueue } from "@/components/dashboard/EmailQueue";
import { EmailDetail } from "@/components/dashboard/EmailDetail";
import { AddEmailModal } from "@/components/dashboard/AddEmailModal";
import { DeleteOldEmailsModal } from "@/components/dashboard/DeleteOldEmailsModal";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

export interface Message {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_snippet: string | null;
  body_full: string | null;
  received_at: string;
  is_demo: boolean;
  processed: boolean;
  provider_message_id: string | null;
  classification?: {
    category: string;
    confidence: string;
    extracted_entities: Record<string, any>;
  };
  proposal?: {
    proposed_action: string;
    summary: string;
    suggested_reply: string | null;
    suggested_time_slots: any[];
  };
  outcome?: {
    final_action: string;
    final_reply_text: string | null;
    status: string;
  };
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showDeleteOld, setShowDeleteOld] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Handle realtime inserts - prepend new messages
  const handleRealtimeInsert = useCallback((newMessage: Message) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === newMessage.id)) return prev;
      return [newMessage, ...prev];
    });
    toast({
      title: "New email",
      description: `From: ${newMessage.from_name || newMessage.from_email}`,
    });
  }, [toast]);

  // Handle realtime updates
  const handleRealtimeUpdate = useCallback((updatedMessage: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
    );
    // Also update selected message if it's the one that was updated
    setSelectedMessage((prev) =>
      prev?.id === updatedMessage.id ? updatedMessage : prev
    );
  }, []);

  // Subscribe to realtime messages
  useRealtimeMessages({
    userId: user?.id,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          classifications (*),
          proposals (*),
          outcomes (*)
        `)
        .order("received_at", { ascending: false });

      if (error) throw error;

      const formattedMessages: Message[] = (data || []).map((msg: any) => ({
        ...msg,
        classification: msg.classifications?.[0] || msg.classifications,
        proposal: msg.proposals?.[0] || msg.proposals,
        outcome: msg.outcomes?.[0] || msg.outcomes,
      }));

      setMessages(formattedMessages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessEmail = async (messageId: string) => {
    setProcessingId(messageId);
    try {
      const { data, error } = await supabase.functions.invoke("process-email", {
        body: { messageId },
      });

      if (error) throw error;

      await fetchMessages();
      
      // Update selected message if it's the one we just processed
      if (selectedMessage?.id === messageId) {
        const updated = messages.find(m => m.id === messageId);
        if (updated) setSelectedMessage(updated);
      }

      toast({
        title: "Email processed",
        description: "AI has analyzed the email and generated a response.",
      });
    } catch (error: any) {
      console.error("Error processing email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process email",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAction = async (messageId: string, action: string, replyText?: string) => {
    try {
      const finalAction = action as "reply" | "draft" | "schedule" | "ask_question" | "archive" | "mark_done" | "decline";
      const status = action === "archive" ? "archived" : action === "decline" ? "declined" : "sent";
      
      // Check if outcome already exists
      const { data: existingOutcome } = await supabase
        .from("outcomes")
        .select("id")
        .eq("message_id", messageId)
        .single();

      if (existingOutcome) {
        // Update existing outcome
        const { error } = await supabase
          .from("outcomes")
          .update({
            final_action: finalAction,
            final_reply_text: replyText || null,
            status: status as "pending" | "sent" | "drafted" | "archived" | "declined",
          })
          .eq("message_id", messageId);

        if (error) throw error;
      } else {
        // Create new outcome
        const { error } = await supabase
          .from("outcomes")
          .insert([{
            message_id: messageId,
            final_action: finalAction,
            final_reply_text: replyText || null,
            status: status as "pending" | "sent" | "drafted" | "archived" | "declined",
          }]);

        if (error) throw error;
      }

      await fetchMessages();
      setSelectedMessage(null);

      toast({
        title: "Action completed",
        description: action === "archive" 
          ? "Email archived" 
          : action === "decline" 
            ? "Email declined" 
            : "Reply sent (demo mode)",
      });
    } catch (error: any) {
      console.error("Error taking action:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete action",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pendingMessages = messages.filter(m => !m.outcome || m.outcome.status === "pending");
  const completedMessages = messages.filter(m => m.outcome && m.outcome.status !== "pending");

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar 
        user={user}
        pendingCount={pendingMessages.length}
        completedCount={completedMessages.length}
        onSignOut={handleSignOut}
        onAddEmail={() => setShowAddEmail(true)}
        onDeleteOld={() => setShowDeleteOld(true)}
      />
      
      <main className="flex-1 flex">
        <EmailQueue
          messages={pendingMessages}
          loading={loading}
          selectedId={selectedMessage?.id}
          processingId={processingId}
          onSelect={setSelectedMessage}
          onProcess={handleProcessEmail}
          onRefresh={fetchMessages}
        />
        
        {selectedMessage && (
          <EmailDetail
            message={selectedMessage}
            processingId={processingId}
            onClose={() => setSelectedMessage(null)}
            onProcess={handleProcessEmail}
            onAction={handleAction}
          />
        )}
      </main>

      <AddEmailModal
        open={showAddEmail}
        onClose={() => setShowAddEmail(false)}
        onSuccess={() => {
          setShowAddEmail(false);
          fetchMessages();
        }}
      />

      <DeleteOldEmailsModal
        open={showDeleteOld}
        onClose={() => setShowDeleteOld(false)}
        onSuccess={() => {
          fetchMessages();
        }}
      />
    </div>
  );
}

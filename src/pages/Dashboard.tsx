import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { EmailQueue } from "@/components/dashboard/EmailQueue";
import { EmailDetail } from "@/components/dashboard/EmailDetail";
import { AddEmailModal } from "@/components/dashboard/AddEmailModal";
import { DeleteOldEmailsModal } from "@/components/dashboard/DeleteOldEmailsModal";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useTutorial } from "@/hooks/useTutorial";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { invokeFunctionWithRetry } from "@/lib/invokeFunctionWithRetry";

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
  const { startTutorial, isActive: tutorialActive } = useTutorial();
  const isMobile = useIsMobile();
  const { isGmailConnected, loading: connectionLoading } = useGoogleConnection();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showDeleteOld, setShowDeleteOld] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [autoSelectId, setAutoSelectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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
      prev.map((m) => (m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m))
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

  // Auto-sync Gmail when connected but no messages exist yet
  const autoSyncTriggered = useRef(false);
  useEffect(() => {
    if (!connectionLoading && isGmailConnected && !loading && messages.length === 0 && !autoSyncTriggered.current) {
      autoSyncTriggered.current = true;
      console.log("Auto-syncing Gmail: connected but no messages found");
      invokeFunctionWithRetry("sync-gmail")
        .then(({ data, error }) => {
          if (!error && data?.imported > 0) {
            toast({ title: "Inbox synced", description: `Imported ${data.imported} emails from Gmail.` });
            fetchMessages();
          }
        })
        .catch((e) => console.error("Auto-sync failed:", e));
    }
  }, [connectionLoading, isGmailConnected, loading, messages.length]);

  // Background polling: sync Gmail every 5 minutes
  useEffect(() => {
    if (!isGmailConnected || connectionLoading) return;

    const syncInBackground = async () => {
      setIsSyncing(true);
      try {
        const { data, error } = await invokeFunctionWithRetry("sync-gmail");
        if (!error && data?.imported > 0) {
          fetchMessages();
        }
      } catch (e) {
        console.error("Background sync failed:", e);
      } finally {
        setIsSyncing(false);
      }
    };

    const intervalId = setInterval(syncInBackground, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(intervalId);
  }, [isGmailConnected, connectionLoading]);

  // Focus-based sync: sync when user returns to tab
  useEffect(() => {
    if (!isGmailConnected || connectionLoading) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        setIsSyncing(true);
        try {
          const { data, error } = await invokeFunctionWithRetry("sync-gmail");
          if (!error && data?.imported > 0) {
            toast({ title: "New emails", description: `Imported ${data.imported} new email${data.imported !== 1 ? "s" : ""}.` });
            fetchMessages();
          }
        } catch (e) {
          console.error("Focus sync failed:", e);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isGmailConnected, connectionLoading, toast]);

  // Auto-trigger tutorial only for brand-new users (first ever login)
  useEffect(() => {
    if (user && !tutorialActive) {
      const seen = localStorage.getItem(`tutorial_seen_${user.id}`);
      const accountAge = Date.now() - new Date(user.created_at).getTime();
      const isNewUser = accountAge < 5 * 60 * 1000; // less than 5 minutes old
      if (!seen && isNewUser) {
        const timer = setTimeout(() => startTutorial(), 800);
        return () => clearTimeout(timer);
      } else if (!seen) {
        // Mark as seen for existing users who never completed the tutorial
        localStorage.setItem(`tutorial_seen_${user.id}`, "true");
      }
    }
  }, [user?.id]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, classifications (*), proposals (*), outcomes (*)`)
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
      toast({ title: "Error", description: "Failed to load messages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessEmail = async (messageId: string, autoSelect = true) => {
    setProcessingId(messageId);
    if (autoSelect) setAutoSelectId(messageId);
    try {
      const { data, error } = await invokeFunctionWithRetry("process-email", {
        body: { messageId },
      });
      if (error) throw error;

      const { data: msgData } = await supabase
        .from("messages")
        .select(`*, classifications (*), proposals (*), outcomes (*)`)
        .eq("id", messageId)
        .single();

      await fetchMessages();

      if (autoSelect && msgData) {
        setSelectedMessage({
          ...msgData,
          classification: msgData.classifications?.[0] || msgData.classifications,
          proposal: msgData.proposals?.[0] || msgData.proposals,
          outcome: msgData.outcomes?.[0] || msgData.outcomes,
        } as Message);
      }

      toast({ title: "Email processed", description: "AI has analyzed the email and generated a response." });
    } catch (error: any) {
      console.error("Error processing email:", error);
      toast({ title: "Error", description: error.message || "Failed to process email", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleAction = async (messageId: string, action: string, replyText?: string) => {
    try {
      const finalAction = action as "reply" | "draft" | "schedule" | "ask_question" | "archive" | "mark_done" | "decline";
      const status = action === "archive" ? "archived" : action === "decline" ? "declined" : "sent";
      
      const { data: existingOutcome } = await supabase
        .from("outcomes")
        .select("id")
        .eq("message_id", messageId)
        .single();

      if (existingOutcome) {
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
        description: action === "archive" ? "Email archived" : action === "decline" ? "Email declined" : "Reply sent (demo mode)",
      });
    } catch (error: any) {
      console.error("Error taking action:", error);
      toast({ title: "Error", description: error.message || "Failed to complete action", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pendingMessages = messages.filter(m => !m.outcome || m.outcome.status === "pending");
  const completedMessages = messages.filter(m => m.outcome && m.outcome.status !== "pending");

  return (
    <div className="h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      <DashboardSidebar 
        user={user}
        pendingCount={pendingMessages.length}
        completedCount={completedMessages.length}
        onSignOut={handleSignOut}
        onAddEmail={() => setShowAddEmail(true)}
        onDeleteOld={() => setShowDeleteOld(true)}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <MobileHeader title="Action Queue" onOpenSidebar={() => setSidebarOpen(true)} />
      
      <main className="flex-1 flex overflow-hidden">
        {/* On mobile: show queue OR detail, not both */}
        {(!isMobile || !selectedMessage) && (
          <EmailQueue
            messages={pendingMessages}
            loading={loading}
            selectedId={selectedMessage?.id}
            processingId={processingId}
            onSelect={setSelectedMessage}
            onProcess={handleProcessEmail}
            onRefresh={fetchMessages}
            resizable
            isSyncing={isSyncing}
          />
        )}
        
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
        onSuccess={() => fetchMessages()}
      />
    </div>
  );
}

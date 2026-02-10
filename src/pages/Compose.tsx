import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { AddEmailModal } from "@/components/dashboard/AddEmailModal";
import { DeleteOldEmailsModal } from "@/components/dashboard/DeleteOldEmailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Send,
  Loader2,
  PenLine,
  Sparkles,
  CalendarClock,
  ArrowLeft,
} from "lucide-react";

interface DraftState {
  to: string;
  subject: string;
  body: string;
}

export default function Compose() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize from navigation state (passed from Chat)
  const initialDraft = (location.state as any)?.draft as DraftState | undefined;

  const [draft, setDraft] = useState<DraftState>({
    to: initialDraft?.to || "",
    subject: initialDraft?.subject || "",
    body: initialDraft?.body || "",
  });
  const [aiInstruction, setAiInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSuggestingTimes, setIsSuggestingTimes] = useState(false);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showDeleteOld, setShowDeleteOld] = useState(false);
  const instructionRef = useRef<HTMLInputElement>(null);

  const handleRefineDraft = async () => {
    const instruction = aiInstruction.trim();
    if (!instruction && !draft.body) return;
    setIsRefining(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            instruction: instruction || "Improve this email draft.",
            currentDraft: draft.to || draft.subject || draft.body ? draft : null,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to refine draft");

      if (result.draft) {
        setDraft({
          to: result.draft.to || draft.to,
          subject: result.draft.subject || draft.subject,
          body: result.draft.body || draft.body,
        });
      }
      setAiInstruction("");
      toast({ title: "Draft updated", description: "AI has refined your email draft." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsRefining(false);
    }
  };

  const handleSuggestTimes = async () => {
    setIsSuggestingTimes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-meeting-times`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ durationMinutes: 60 }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to suggest times");

      if (result.slots && result.slots.length > 0) {
        const slotLabels = result.slots.map((s: any) => {
          const start = new Date(s.start);
          return start.toLocaleString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
        });

        // Now call refine-draft with the slots to weave them into the email
        const refineResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-draft`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              instruction: "Add the suggested available meeting times into the email body naturally.",
              currentDraft: draft,
              meetingSlots: slotLabels.map((label: string) => ({ label })),
            }),
          }
        );

        const refineResult = await refineResp.json();
        if (refineResult.draft) {
          setDraft({
            to: refineResult.draft.to || draft.to,
            subject: refineResult.draft.subject || draft.subject,
            body: refineResult.draft.body || draft.body,
          });
        }
        toast({ title: "Times added", description: `${slotLabels.length} available slots inserted into your draft.` });
      } else {
        toast({ title: "No slots", description: "No available meeting slots found in the next 7 days.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSuggestingTimes(false);
    }
  };

  const handleSend = async () => {
    if (!draft.to || !draft.subject || !draft.body) {
      toast({ title: "Missing fields", description: "Please fill in To, Subject, and Body.", variant: "destructive" });
      return;
    }
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-new-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(draft),
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Failed to send email");

      toast({ title: "Email sent!", description: `Your email to ${draft.to} has been sent.` });
      navigate("/chat");
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleInstructionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefineDraft();
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar
        user={user}
        pendingCount={0}
        completedCount={0}
        onSignOut={signOut}
        onAddEmail={() => setShowAddEmail(true)}
        onDeleteOld={() => setShowDeleteOld(true)}
      />

      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <PenLine className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Compose Email</h1>
            <p className="text-sm text-muted-foreground">Draft, refine with AI, and send</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {/* Email fields */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">To</label>
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Subject</label>
                <Input
                  placeholder="Email subject"
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Body</label>
                <Textarea
                  placeholder="Write your email here or let AI draft it..."
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  className="min-h-[250px]"
                  rows={12}
                />
              </div>
            </div>

            {/* AI Refinement */}
            <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="w-4 h-4 text-accent" />
                AI Assistant
              </div>
              <div className="flex gap-2">
                <Input
                  ref={instructionRef}
                  placeholder="e.g. Make it more formal, add a greeting, shorten it..."
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  onKeyDown={handleInstructionKeyDown}
                  disabled={isRefining}
                />
                <Button
                  onClick={handleRefineDraft}
                  disabled={isRefining || (!aiInstruction.trim() && !draft.body)}
                  variant="secondary"
                  className="flex-shrink-0"
                >
                  {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="ml-1.5">Refine</span>
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestTimes}
                disabled={isSuggestingTimes}
                className="gap-1.5"
              >
                {isSuggestingTimes ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                Suggest Meeting Times
              </Button>
            </div>

            {/* Send */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/chat")}>Cancel</Button>
              <Button
                variant="action"
                onClick={handleSend}
                disabled={isSending || !draft.to || !draft.subject || !draft.body}
                className="gap-1.5"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Email
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AddEmailModal open={showAddEmail} onClose={() => setShowAddEmail(false)} onSuccess={() => setShowAddEmail(false)} />
      <DeleteOldEmailsModal open={showDeleteOld} onClose={() => setShowDeleteOld(false)} onSuccess={() => setShowDeleteOld(false)} />
    </div>
  );
}

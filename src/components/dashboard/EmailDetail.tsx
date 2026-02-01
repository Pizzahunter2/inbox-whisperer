import { useState } from "react";
import { Message } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  X, 
  Loader2, 
  Send, 
  Archive, 
  XCircle,
  Clock,
  User,
  Calendar,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface EmailDetailProps {
  message: Message;
  processingId: string | null;
  onClose: () => void;
  onProcess: (messageId: string) => void;
  onAction: (messageId: string, action: string, replyText?: string) => void;
}

const categoryLabels: Record<string, string> = {
  meeting_request: "Meeting Request",
  action_needed: "Action Needed",
  fyi: "FYI",
  newsletter: "Newsletter",
  other: "Other",
};

export function EmailDetail({ 
  message, 
  processingId,
  onClose, 
  onProcess,
  onAction 
}: EmailDetailProps) {
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [editingReply, setEditingReply] = useState(false);
  const [replyText, setReplyText] = useState(message.proposal?.suggested_reply || "");
  const [submitting, setSubmitting] = useState(false);

  const isProcessing = processingId === message.id;
  const hasProposal = !!message.proposal;
  const entities = message.classification?.extracted_entities || {};

  const handleSendReply = async () => {
    setSubmitting(true);
    await onAction(message.id, "reply", replyText);
    setSubmitting(false);
  };

  const handleArchive = async () => {
    setSubmitting(true);
    await onAction(message.id, "archive");
    setSubmitting(false);
  };

  const handleDecline = async () => {
    setSubmitting(true);
    await onAction(message.id, "decline");
    setSubmitting(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <User className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {message.from_name || message.from_email.split("@")[0]}
            </h2>
            <p className="text-sm text-muted-foreground">
              {message.from_email}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Subject & metadata */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {message.subject}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(message.received_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
            {message.classification && (
              <Badge variant="secondary">
                {categoryLabels[message.classification.category] || message.classification.category}
              </Badge>
            )}
          </div>
        </div>

        {/* AI Analysis section */}
        {hasProposal ? (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-accent mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI Summary</span>
              </div>
              <p className="text-foreground">{message.proposal.summary}</p>
            </div>

            {/* Extracted entities */}
            {Object.keys(entities).length > 0 && (
              <div className="bg-muted/50 rounded-xl p-4">
                <h4 className="font-medium text-foreground mb-3">Key Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  {entities.date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{entities.date}</span>
                    </div>
                  )}
                  {entities.time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{entities.time}</span>
                    </div>
                  )}
                  {entities.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{entities.location}</span>
                    </div>
                  )}
                  {entities.deadline && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-warning" />
                      <span className="text-warning">Deadline: {entities.deadline}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Suggested time slots for meeting requests */}
            {message.classification?.category === "meeting_request" && 
             message.proposal.suggested_time_slots?.length > 0 && (
              <div className="bg-info/5 border border-info/20 rounded-xl p-4">
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-info" />
                  Suggested Times
                </h4>
                <div className="space-y-2">
                  {message.proposal.suggested_time_slots.map((slot: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between bg-background rounded-lg px-3 py-2 text-sm"
                    >
                      <span>{slot.date} at {slot.time}</span>
                      <Badge variant="outline" className="text-xs">
                        {slot.duration || "30 min"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed reply */}
            {message.proposal.suggested_reply && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Send className="w-4 h-4 text-accent" />
                    Proposed Reply
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEditingReply(!editingReply);
                      if (!editingReply) {
                        setReplyText(message.proposal?.suggested_reply || "");
                      }
                    }}
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    {editingReply ? "Cancel" : "Edit"}
                  </Button>
                </div>
                
                {editingReply ? (
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-32"
                    placeholder="Edit your reply..."
                  />
                ) : (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {message.proposal.suggested_reply}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Not yet processed */
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Not yet analyzed</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Let AI analyze this email to get a summary and proposed response.
            </p>
            <Button 
              variant="action"
              onClick={() => onProcess(message.id)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Email
                </>
              )}
            </Button>
          </div>
        )}

        {/* Original email (collapsible) */}
        <div className="mt-6 border-t border-border pt-6">
          <button
            onClick={() => setShowFullEmail(!showFullEmail)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showFullEmail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showFullEmail ? "Hide" : "Show"} original email
          </button>
          
          {showFullEmail && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {message.body_full || message.body_snippet || "No content available"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {hasProposal && (
        <div className="p-6 border-t border-border bg-card">
          <div className="flex items-center gap-3">
            <Button 
              variant="action" 
              className="flex-1"
              onClick={handleSendReply}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Reply
            </Button>
            <Button 
              variant="subtle"
              onClick={handleArchive}
              disabled={submitting}
            >
              <Archive className="w-4 h-4" />
              Archive
            </Button>
            <Button 
              variant="ghost"
              onClick={handleDecline}
              disabled={submitting}
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

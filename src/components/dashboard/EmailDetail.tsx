import { useState, useEffect, useCallback } from "react";
import { Message } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MeetingTimeSelector } from "./MeetingTimeSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  Edit3,
  CalendarPlus,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";

interface TimeSlot {
  start: string;
  end: string;
  date?: string;
  time?: string;
  duration?: string;
  calendarEvent?: {
    eventId: string;
    eventLink: string;
    createdAt: string;
  };
}

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
  const { toast } = useToast();
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [editingReply, setEditingReply] = useState(true); // Always editable
  const [replyText, setReplyText] = useState(message.proposal?.suggested_reply || "");
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [calendarEventLink, setCalendarEventLink] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const isProcessing = processingId === message.id;
  const hasProposal = !!message.proposal;
  const entities = message.classification?.extracted_entities || {};
  const isMeetingRequest = message.classification?.category === "meeting_request";
  const timeSlots = (message.proposal?.suggested_time_slots || []) as TimeSlot[];

  // Filter out calendar event metadata from slots
  const selectableSlots = timeSlots.filter(slot => !slot.calendarEvent);

  // Update reply text when a time slot is selected
  const updateReplyWithSelectedTime = useCallback((slot: TimeSlot) => {
    const originalReply = message.proposal?.suggested_reply || "";
    
    // Format the selected time nicely
    let selectedTimeStr = "";
    try {
      if (slot.start) {
        const startDate = parseISO(slot.start);
        selectedTimeStr = format(startDate, "EEEE, MMMM d 'at' h:mm a") + " ET";
      } else if (slot.date && slot.time) {
        selectedTimeStr = `${slot.date} at ${slot.time} ET`;
      }
    } catch {
      selectedTimeStr = slot.date && slot.time ? `${slot.date} at ${slot.time} ET` : "the selected time";
    }

    // Generate updated reply that confirms the specific time
    // Try to keep the same tone by analyzing the original
    const isFormal = originalReply.includes("Dear") || originalReply.includes("Regards");
    const isFriendly = originalReply.includes("Hi!") || originalReply.includes("Thanks!");
    
    let newReply = "";
    
    if (isFormal) {
      newReply = `Dear ${message.from_name || message.from_email.split("@")[0]},

Thank you for reaching out. I would be happy to meet at ${selectedTimeStr}.

Please let me know if this time works for you, and I will send a calendar invitation.

Best regards`;
    } else if (isFriendly) {
      newReply = `Hi ${message.from_name || message.from_email.split("@")[0]}!

Thanks for getting in touch! Let's meet at ${selectedTimeStr}.

Looking forward to it!`;
    } else {
      newReply = `Hi ${message.from_name || message.from_email.split("@")[0]},

Thanks for your message. I'm available at ${selectedTimeStr}.

Let me know if that works for you.

Best`;
    }

    setReplyText(newReply);
  }, [message]);

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
    updateReplyWithSelectedTime(slot);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          messageId: message.id,
          threadId: message.provider_message_id,
          toEmail: message.from_email,
          subject: message.subject,
          replyText,
        },
      });

      if (error) throw error;

      if (data?.needsReconnect) {
        setNeedsReconnect(true);
        toast({
          title: "Reconnection Required",
          description: "Please reconnect your Google account with send permissions.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email Sent!",
        description: "Your reply has been sent successfully via Gmail.",
      });

      // Refresh the parent
      onAction(message.id, "reply", replyText);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateCalendarEvent = async () => {
    if (!selectedTimeSlot) {
      toast({
        title: "Select a Time",
        description: "Please select a meeting time first.",
        variant: "destructive",
      });
      return;
    }

    setCreatingEvent(true);
    try {
      // Calculate end time (default 30 min if not specified)
      let startTime = selectedTimeSlot.start;
      let endTime = selectedTimeSlot.end;

      if (!startTime || !endTime) {
        toast({
          title: "Invalid Time",
          description: "Could not parse the selected time slot.",
          variant: "destructive",
        });
        return;
      }

      const eventTitle = `Meeting: ${message.from_name || message.subject}`;
      const eventDescription = `Email from: ${message.from_email}\nSubject: ${message.subject}\n\nOriginal message:\n${message.body_snippet || message.body_full || ""}`;

      const { data, error } = await supabase.functions.invoke("create-calendar-event", {
        body: {
          messageId: message.id,
          title: eventTitle,
          selectedStart: startTime,
          selectedEnd: endTime,
          description: eventDescription,
          attendeeEmail: message.from_email,
        },
      });

      if (error) throw error;

      if (data?.needsReconnect) {
        setNeedsReconnect(true);
        toast({
          title: "Reconnection Required",
          description: "Please reconnect your Google account with calendar permissions.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCalendarEventLink(data.eventLink);

      toast({
        title: "Event Created!",
        description: "Calendar invitation has been sent to the attendee.",
      });

      // Optionally update reply to mention calendar invite
      if (replyText && !replyText.includes("calendar invite")) {
        setReplyText(prev => prev + "\n\nI've also sent you a calendar invitation for our meeting.");
      }
    } catch (error: any) {
      console.error("Error creating calendar event:", error);
      toast({
        title: "Failed to Create Event",
        description: error.message || "Could not create calendar event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleReconnectGoogle = () => {
    // Navigate to settings for reconnection
    window.location.href = "/settings";
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

  // Reset state when message changes
  useEffect(() => {
    setReplyText(message.proposal?.suggested_reply || "");
    setSelectedTimeSlot(null);
    setCalendarEventLink(null);
    setNeedsReconnect(false);
  }, [message.id]);

  return (
    <div className="flex-1 flex flex-col bg-background h-full max-h-full overflow-hidden">
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
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
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

        {/* Reconnect warning */}
        {needsReconnect && (
          <div className="mb-6 bg-warning/10 border border-warning/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Google Account Needs Reconnection</p>
                <p className="text-sm text-muted-foreground">
                  New permissions are required for sending emails and creating calendar events.
                </p>
              </div>
              <Button variant="warning" size="sm" onClick={handleReconnectGoogle}>
                Reconnect
              </Button>
            </div>
          </div>
        )}

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

            {/* Meeting time selector for meeting requests */}
            {isMeetingRequest && selectableSlots.length > 0 && (
              <MeetingTimeSelector
                slots={selectableSlots}
                selectedSlot={selectedTimeSlot}
                onSelect={handleTimeSlotSelect}
                timezone="ET"
              />
            )}

            {/* Calendar event link if created */}
            {calendarEventLink && (
              <div className="bg-success/10 border border-success/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-success">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">Calendar Event Created</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(calendarEventLink, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open Event
                  </Button>
                </div>
              </div>
            )}

            {/* Editable reply area */}
            {message.proposal.suggested_reply && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-accent" />
                    Reply Draft
                    {selectedTimeSlot && (
                      <Badge variant="secondary" className="ml-2">
                        Time selected
                      </Badge>
                    )}
                  </h4>
                </div>
                
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-40 font-mono text-sm"
                  placeholder="Edit your reply..."
                />

                <div className="mt-4 pt-4 border-t border-border">
                  <h5 className="text-sm font-medium text-foreground mb-3">Actions</h5>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="action"
                      className="flex-1"
                      onClick={handleSendEmail}
                      disabled={sendingEmail || !replyText.trim() || needsReconnect}
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Email
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={handleCreateCalendarEvent}
                      disabled={creatingEvent || !selectedTimeSlot || needsReconnect || !!calendarEventLink}
                    >
                      {creatingEvent ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : calendarEventLink ? (
                        <>
                          <Calendar className="w-4 h-4" />
                          Event Created
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="w-4 h-4" />
                          Create Calendar Event
                        </>
                      )}
                    </Button>
                  </div>
                </div>
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

        {/* Original email (collapsible, collapsed by default) */}
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

      {/* Action bar - always visible at bottom */}
      {hasProposal && (
        <div className="p-6 border-t border-border bg-card shrink-0">
          <div className="flex items-center justify-end gap-3">
            <Button variant="subtle" onClick={handleArchive} disabled={submitting}>
              <Archive className="w-4 h-4" />
              Archive
            </Button>
            <Button variant="ghost" onClick={handleDecline} disabled={submitting}>
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

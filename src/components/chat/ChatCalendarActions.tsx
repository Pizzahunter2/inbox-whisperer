import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradeDialog } from "@/components/UpgradeDialog";

export interface CalendarEvent {
  title: string;
  date: string; // e.g. "Feb 11, 2026" or ISO string
  time?: string; // e.g. "3:00 PM"
  endTime?: string;
  description?: string;
  attendeeEmail?: string;
}

/**
 * Extracts calendar-worthy events from an AI message.
 * Looks for patterns like dates, meetings, deadlines mentioned in the text.
 */
export function extractCalendarEvents(content: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = content.split("\n");

  // Pattern: "Today, Wednesday, Feb 11 @ 3:00 PM:" or "Tomorrow, Thursday, Feb 12 @ 9:00 AM:"
  const dateTimePattern = /(?:Today|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:,?\s+\d{4})?)\s*[@at]*\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/gi;
  
  // Pattern: "Feb 10, 2026 / 10:00 AM" or "Feb 11 at 3:00 PM"
  const simpleDateTimePattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:,?\s+\d{4})?)\s*(?:\/|at|@)\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/gi;

  // Pattern for deadlines: "deadline" or "due" near a date
  const deadlinePattern = /(?:deadline|due(?:\s+date)?)[:\s]+(?:.*?)((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:,?\s+\d{4})?)/gi;

  const seenKeys = new Set<string>();

  for (const line of lines) {
    // Check for meeting-related lines with dates
    const isMeetingLine = /meeting|scheduled|proposed|confirmed|request|appointment|call|session/i.test(line);
    const isDeadlineLine = /deadline|due|submit|expir/i.test(line);
    
    if (!isMeetingLine && !isDeadlineLine) continue;

    // Try dateTimePattern
    let match: RegExpExecArray | null;
    dateTimePattern.lastIndex = 0;
    while ((match = dateTimePattern.exec(line)) !== null) {
      const key = `${match[1]}-${match[2]}`.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Extract title from context
      const title = extractTitle(line) || (isDeadlineLine ? "Deadline" : "Meeting");
      events.push({ title, date: match[1].trim(), time: match[2].trim() });
    }

    // Try simpleDateTimePattern
    simpleDateTimePattern.lastIndex = 0;
    while ((match = simpleDateTimePattern.exec(line)) !== null) {
      const key = `${match[1]}-${match[2]}`.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const title = extractTitle(line) || (isDeadlineLine ? "Deadline" : "Meeting");
      events.push({ title, date: match[1].trim(), time: match[2].trim() });
    }

    // Try deadline pattern (date only)
    if (isDeadlineLine && events.length === 0) {
      deadlinePattern.lastIndex = 0;
      while ((match = deadlinePattern.exec(line)) !== null) {
        const key = match[1].toLowerCase();
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        events.push({ title: "Deadline", date: match[1].trim() });
      }
    }
  }

  return events;
}

function extractTitle(line: string): string {
  // Try to get subject from "Subject: ..." pattern
  const subjectMatch = line.match(/Subject:\s*(.+?)(?:\)|$|\.)/i);
  if (subjectMatch) return subjectMatch[1].trim();

  // Try to get a meaningful title from "meeting with X" or similar
  const meetingMatch = line.match(/(?:meeting|call|session|appointment)\s+(?:with\s+)?(.+?)(?:\s*(?:\(|@|at|on|,|$))/i);
  if (meetingMatch) return `Meeting: ${meetingMatch[1].trim()}`;

  return "";
}

function parseEventToISO(event: CalendarEvent): { start: string; end: string } | null {
  try {
    const year = new Date().getFullYear();
    let dateStr = event.date;
    // Ensure year is present
    if (!/\d{4}/.test(dateStr)) {
      dateStr = `${dateStr}, ${year}`;
    }

    if (event.time) {
      const fullStr = `${dateStr} ${event.time}`;
      const parsed = new Date(fullStr);
      if (isNaN(parsed.getTime())) return null;
      const end = new Date(parsed.getTime() + 60 * 60 * 1000); // 1 hour default
      return { start: parsed.toISOString(), end: end.toISOString() };
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return null;
      parsed.setHours(9, 0, 0, 0); // Default to 9 AM
      const end = new Date(parsed.getTime() + 60 * 60 * 1000);
      return { start: parsed.toISOString(), end: end.toISOString() };
    }
  } catch {
    return null;
  }
}

interface ChatCalendarActionsProps {
  events: CalendarEvent[];
}

export function ChatCalendarActions({ events }: ChatCalendarActionsProps) {
  const { toast } = useToast();
  const { incrementCalendarAdds, canAddToCalendar } = useUsageLimits();
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (events.length === 0) return null;

  const handleAddToCalendar = async (event: CalendarEvent, index: number) => {
    // Check limit
    const allowed = await incrementCalendarAdds();
    if (!allowed) {
      setShowUpgrade(true);
      return;
    }

    const times = parseEventToISO(event);
    if (!times) {
      toast({ title: "Invalid date", description: "Couldn't parse the event date.", variant: "destructive" });
      return;
    }

    setAddingIndex(index);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-calendar-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            title: event.title,
            startTime: times.start,
            endTime: times.end,
            description: event.description || "",
            attendeeEmail: event.attendeeEmail,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create event");

      setAddedIndices((prev) => new Set(prev).add(index));
      toast({ title: "Added to Calendar", description: `"${event.title}" has been added to your Google Calendar.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAddingIndex(null);
    }
  };

  return (
    <div className="mt-3 bg-info/5 border border-info/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-info/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-info" />
          {events.length} event{events.length > 1 ? "s" : ""} detected
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {events.map((event, i) => {
            const isAdded = addedIndices.has(i);
            const isAdding = addingIndex === i;

            return (
              <div key={i} className="flex items-center justify-between gap-3 bg-background rounded-lg px-3 py-2.5 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.date}{event.time ? ` at ${event.time}` : ""}
                  </p>
                </div>
                <Button
                  variant={isAdded ? "outline" : "action"}
                  size="sm"
                  disabled={isAdded || isAdding}
                  onClick={() => handleAddToCalendar(event, i)}
                  className="gap-1.5 flex-shrink-0"
                >
                  {isAdding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAdded ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5" />
                  )}
                  {isAdded ? "Added" : "Add to Calendar"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title="Daily Calendar Limit Reached"
        description="Free plan users can add up to 5 calendar events per day. Upgrade for unlimited."
      />
    </div>
  );
}

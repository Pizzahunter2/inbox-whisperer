import { Message } from "@/pages/Dashboard";

export interface EmailTag {
  id: string;
  label: string;
  color: string; // Tailwind classes for bg and text
  bgClass: string;
  textClass: string;
}

export const TAG_DEFINITIONS: EmailTag[] = [
  { id: "urgent", label: "Urgent", color: "red", bgClass: "bg-destructive/15", textClass: "text-destructive" },
  { id: "high_priority", label: "High Priority", color: "red", bgClass: "bg-destructive/15", textClass: "text-destructive" },
  { id: "meeting", label: "Meeting Request", color: "yellow", bgClass: "bg-warning/15", textClass: "text-warning" },
  { id: "action_needed", label: "Action Needed", color: "orange", bgClass: "bg-orange-500/15", textClass: "text-orange-600 dark:text-orange-400" },
  { id: "deadline", label: "Has Deadline", color: "red", bgClass: "bg-destructive/15", textClass: "text-destructive" },
  { id: "financial", label: "Financial", color: "purple", bgClass: "bg-purple-500/15", textClass: "text-purple-600 dark:text-purple-400" },
  { id: "update", label: "Update", color: "green", bgClass: "bg-emerald-500/15", textClass: "text-emerald-600 dark:text-emerald-400" },
  { id: "newsletter", label: "Newsletter", color: "blue", bgClass: "bg-blue-500/15", textClass: "text-blue-600 dark:text-blue-400" },
  { id: "security", label: "Security Alert", color: "red", bgClass: "bg-destructive/15", textClass: "text-destructive" },
  { id: "personal", label: "Personal", color: "teal", bgClass: "bg-teal-500/15", textClass: "text-teal-600 dark:text-teal-400" },
  { id: "scheduling", label: "Scheduling", color: "yellow", bgClass: "bg-warning/15", textClass: "text-warning" },
  { id: "other", label: "Other", color: "gray", bgClass: "bg-muted", textClass: "text-muted-foreground" },
];

export function getTagById(id: string): EmailTag | undefined {
  return TAG_DEFINITIONS.find((t) => t.id === id);
}

export function deriveTagsForMessage(message: Message): EmailTag[] {
  const tags: EmailTag[] = [];
  const category = message.classification?.category;
  const confidence = message.classification?.confidence;
  const entities = message.classification?.extracted_entities || {};
  const subject = (message.subject || "").toLowerCase();
  const snippet = (message.body_snippet || "").toLowerCase();
  const combined = `${subject} ${snippet}`;

  if (!category) {
    return [TAG_DEFINITIONS.find((t) => t.id === "other")!];
  }

  // Category-based tags
  if (category === "meeting_request") {
    tags.push(getTagById("meeting")!);
  }

  if (category === "action_needed") {
    tags.push(getTagById("action_needed")!);
  }

  if (category === "newsletter") {
    tags.push(getTagById("newsletter")!);
  }

  if (category === "fyi") {
    tags.push(getTagById("update")!);
  }

  // Entity-based tags
  if (entities.deadline || entities.due_date || entities.expiration) {
    tags.push(getTagById("deadline")!);
  }

  if (
    entities.amount ||
    entities.invoice ||
    entities.payment ||
    combined.includes("invoice") ||
    combined.includes("payment") ||
    combined.includes("billing")
  ) {
    tags.push(getTagById("financial")!);
  }

  // Keyword-based tags
  if (
    combined.includes("urgent") ||
    combined.includes("asap") ||
    combined.includes("immediately") ||
    combined.includes("critical")
  ) {
    tags.push(getTagById("urgent")!);
  }

  if (
    confidence === "high" &&
    (category === "action_needed" || entities.deadline)
  ) {
    if (!tags.some((t) => t.id === "high_priority")) {
      tags.push(getTagById("high_priority")!);
    }
  }

  if (
    combined.includes("password") ||
    combined.includes("login") ||
    combined.includes("security") ||
    combined.includes("mfa") ||
    combined.includes("authentication") ||
    combined.includes("suspicious")
  ) {
    tags.push(getTagById("security")!);
  }

  if (
    combined.includes("schedule") ||
    combined.includes("calendar") ||
    combined.includes("reschedule") ||
    combined.includes("availability")
  ) {
    if (!tags.some((t) => t.id === "meeting")) {
      tags.push(getTagById("scheduling")!);
    }
  }

  // If no tags matched at all, mark as other
  if (tags.length === 0) {
    tags.push(getTagById("other")!);
  }

  // Deduplicate
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

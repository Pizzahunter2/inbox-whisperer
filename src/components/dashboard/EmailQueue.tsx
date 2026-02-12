import { useState, useMemo, useRef, useCallback } from "react";
import { Message } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { invokeFunctionWithRetry } from "@/lib/invokeFunctionWithRetry";
import { deriveTagsForMessage, TAG_DEFINITIONS } from "@/lib/emailTags";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  X,
  Square,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface EmailQueueProps {
  messages: Message[];
  loading: boolean;
  selectedId?: string;
  processingId: string | null;
  onSelect: (message: Message) => void;
  onProcess: (messageId: string, autoSelect?: boolean) => void;
  onRefresh?: () => void;
}

export function EmailQueue({
  messages,
  loading,
  selectedId,
  processingId,
  onSelect,
  onProcess,
  onRefresh,
}: EmailQueueProps) {
  const { toast } = useToast();
  const { isPro } = useSubscription();
  const { canAnalyze, analysesRemaining, incrementAnalyses } = useUsageLimits();
  const [syncing, setSyncing] = useState(false);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number>(25);
  const stopBulkRef = useRef(false);

  const messagesWithTags = useMemo(
    () => messages.map((m) => ({ message: m, tags: deriveTagsForMessage(m) })),
    [messages]
  );

  const availableTags = useMemo(() => {
    const tagIds = new Set<string>();
    messagesWithTags.forEach(({ tags }) => tags.forEach((t) => tagIds.add(t.id)));
    return TAG_DEFINITIONS.filter((t) => tagIds.has(t.id));
  }, [messagesWithTags]);

  const filteredMessages = useMemo(() => {
    return messagesWithTags.filter(({ message, tags }) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          (message.from_name || "").toLowerCase().includes(q) ||
          message.from_email.toLowerCase().includes(q) ||
          message.subject.toLowerCase().includes(q) ||
          (message.body_snippet || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (activeTagFilters.length > 0) {
        if (!tags.some((t) => activeTagFilters.includes(t.id))) return false;
      }
      return true;
    });
  }, [messagesWithTags, searchQuery, activeTagFilters]);

  const toggleTagFilter = (tagId: string) => {
    setActiveTagFilters((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    setActiveTagFilters([]);
    setSearchQuery("");
  };

  const handleStopBulk = useCallback(() => {
    stopBulkRef.current = true;
  }, []);

  const handleBulkAnalyze = async () => {
    const unanalyzed = messages.filter((m) => !m.classification);
    if (unanalyzed.length === 0) {
      toast({ title: "No Emails", description: "All emails have already been analyzed." });
      return;
    }
    setBulkAnalyzing(true);
    stopBulkRef.current = false;
    let success = 0;
    let failed = 0;
    for (const msg of unanalyzed) {
      if (stopBulkRef.current) break;
      // Check usage limit before each analysis
      const allowed = await incrementAnalyses();
      if (!allowed) {
        setShowUpgrade(true);
        break;
      }
      try {
        onProcess(msg.id, false);
        success++;
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        failed++;
      }
    }
    const wasStopped = stopBulkRef.current;
    setBulkAnalyzing(false);
    stopBulkRef.current = false;
    toast({
      title: wasStopped ? "Analysis Stopped" : "Bulk Analysis Complete",
      description: `Analyzed ${success} email${success !== 1 ? "s" : ""}.${failed > 0 ? ` ${failed} failed.` : ""}${wasStopped ? " Remaining emails skipped." : ""}`,
    });
  };

  const handleSyncGmail = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeFunctionWithRetry("sync-gmail");
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Sync Issue", description: data.error, variant: "destructive" });
        return;
      }
      const imported = data?.imported || 0;
      const skipped = data?.skipped || 0;
      toast({
        title: "Inbox Synced",
        description: imported > 0
          ? `Imported ${imported} new email${imported !== 1 ? "s" : ""}.`
          : `Inbox up to date (${skipped} already synced).`,
      });
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({ title: "Sync Failed", description: error.message || "Could not sync Gmail.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full md:w-[480px] border-r border-border p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const hasActiveFilters = activeTagFilters.length > 0 || searchQuery.trim().length > 0;

  return (
    <div className="w-full md:w-[480px] border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Action Queue</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" disabled={bulkAnalyzing} onClick={handleBulkAnalyze}>
              {bulkAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="hidden sm:inline">Analyze All</span>
              <span className="sm:hidden">All</span>
            </Button>
            {bulkAnalyzing && (
              <Button variant="destructive" size="sm" onClick={handleStopBulk}>
                <Square className="w-3 h-3" />
                Stop
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSyncGmail} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync
            </Button>
          </div>
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {isPro ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={activeTagFilters.length > 0 ? "default" : "outline"}
                  size="sm"
                  className="h-9 gap-1.5"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {activeTagFilters.length > 0 && (
                    <span className="ml-1 bg-primary-foreground/20 rounded-full px-1.5 text-xs">
                      {activeTagFilters.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-1">
                  <p className="text-sm font-medium mb-2">Filter by tag</p>
                  {availableTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={activeTagFilters.includes(tag.id)}
                        onCheckedChange={() => toggleTagFilter(tag.id)}
                      />
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tag.bgClass} ${tag.textClass}`}>
                        {tag.label}
                      </span>
                    </label>
                  ))}
                  {activeTagFilters.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveTagFilters([])} className="w-full mt-2 text-xs">
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 opacity-50" disabled title="Upgrade to Pro">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTagFilters.map((tagId) => {
              const tag = TAG_DEFINITIONS.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tag.bgClass} ${tag.textClass}`}
                >
                  {tag.label}
                  <X className="w-3 h-3" />
                </button>
              );
            })}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Clear all
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredMessages.length === messages.length
              ? `${messages.length} email${messages.length !== 1 ? "s" : ""} waiting for review`
              : `${filteredMessages.length} of ${messages.length} emails`}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Show:</span>
            <Select value={String(displayLimit)} onValueChange={(v) => setDisplayLimit(Number(v))}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="99999">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">
              {messages.length === 0 ? "All caught up!" : "No matching emails"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {messages.length === 0
                ? "No emails waiting for review. Click Sync to check for new emails."
                : "Try adjusting your search or filters."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          filteredMessages.slice(0, displayLimit).map(({ message, tags }) => {
            const isProcessing = processingId === message.id;
            const isSelected = selectedId === message.id;

            return (
              <button
                key={message.id}
                onClick={() => onSelect(message)}
                className={`w-full text-left p-4 border-b border-border transition-colors ${
                  isSelected
                    ? "bg-accent/5 border-l-2 border-l-accent"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-foreground truncate">
                        {message.from_name || message.from_email.split("@")[0]}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(message.received_at), { addSuffix: true })}
                      </span>
                    </div>

                    <p className="text-sm text-foreground font-medium truncate mb-1">
                      {message.subject}
                    </p>

                    {message.proposal?.summary ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {message.proposal.summary}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {message.body_snippet || "No preview available"}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {message.classification ? (
                        isPro ? (
                          tags.map((tag) => (
                            <span
                              key={tag.id}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.bgClass} ${tag.textClass}`}
                            >
                              {tag.label}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                            Analyzed ✓
                          </span>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!isPro) {
                              const allowed = await incrementAnalyses();
                              if (!allowed) {
                                setShowUpgrade(true);
                                return;
                              }
                            }
                            onProcess(message.id);
                          }}
                          disabled={isProcessing || (!isPro && !canAnalyze)}
                          className="h-7 text-xs"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              Analyze{!isPro ? ` (${analysesRemaining})` : ""}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        title="Daily Analysis Limit Reached"
        description="Free plan users can analyze up to 5 emails per day. Upgrade to Pro for unlimited analyses."
      />
    </div>
  );
}

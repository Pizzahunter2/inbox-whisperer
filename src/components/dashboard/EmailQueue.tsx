import { useState } from "react";
import { Message } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { invokeFunctionWithRetry } from "@/lib/invokeFunctionWithRetry";
import {
  Loader2,
  Calendar,
  AlertCircle,
  Info,
  Newspaper,
  HelpCircle,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EmailQueueProps {
  messages: Message[];
  loading: boolean;
  selectedId?: string;
  processingId: string | null;
  onSelect: (message: Message) => void;
  onProcess: (messageId: string) => void;
  onRefresh?: () => void;
}

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  meeting_request: { icon: Calendar, color: "bg-info/10 text-info", label: "Meeting" },
  action_needed: { icon: AlertCircle, color: "bg-warning/10 text-warning", label: "Action" },
  fyi: { icon: Info, color: "bg-muted text-muted-foreground", label: "FYI" },
  newsletter: { icon: Newspaper, color: "bg-secondary text-secondary-foreground", label: "Newsletter" },
  other: { icon: HelpCircle, color: "bg-muted text-muted-foreground", label: "Other" },
};

const confidenceColors: Record<string, string> = {
  high: "text-success",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export function EmailQueue({ 
  messages, 
  loading, 
  selectedId,
  processingId,
  onSelect,
  onProcess,
  onRefresh
}: EmailQueueProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSyncGmail = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeFunctionWithRetry("sync-gmail");

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Sync Issue",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      
      const imported = data?.imported || 0;
      const skipped = data?.skipped || 0;
      
      toast({
        title: "Inbox Synced",
        description: imported > 0 
          ? `Imported ${imported} new email${imported !== 1 ? 's' : ''}.`
          : `Inbox up to date (${skipped} already synced).`,
      });
      
      // Refresh the messages list
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync Gmail. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-96 border-r border-border p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="w-96 border-r border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Action Queue</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncGmail}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-2">All caught up!</h3>
          <p className="text-sm text-muted-foreground">
            No emails waiting for review. Click Sync to check for new emails.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Action Queue</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncGmail}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {messages.length} email{messages.length !== 1 ? "s" : ""} waiting for review
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.map((message) => {
          const category = message.classification?.category;
          const config = category ? categoryConfig[category] : null;
          const CategoryIcon = config?.icon || HelpCircle;
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
                <div className={`w-10 h-10 rounded-lg ${config?.color || "bg-muted text-muted-foreground"} flex items-center justify-center flex-shrink-0`}>
                  <CategoryIcon className="w-5 h-5" />
                </div>

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

                  {/* Status row */}
                  <div className="flex items-center gap-2 mt-2">
                    {message.classification ? (
                      <>
                        <Badge variant="secondary" className="text-xs">
                          {config?.label || "Unknown"}
                        </Badge>
                        <span className={`text-xs ${confidenceColors[message.classification.confidence] || ""}`}>
                          {message.classification.confidence} confidence
                        </span>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="action"
                        onClick={(e) => {
                          e.stopPropagation();
                          onProcess(message.id);
                        }}
                        disabled={isProcessing}
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
                            Analyze
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
        })}
      </div>
    </div>
  );
}

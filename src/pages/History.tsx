import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DeleteOldEmailsModal } from "@/components/dashboard/DeleteOldEmailsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  Calendar,
  Clock,
  Send,
  Archive,
  XCircle,
  CheckCircle,
  ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface HistoryMessage {
  id: string;
  from_name: string | null;
  from_email: string;
  subject: string;
  received_at: string;
  classification?: {
    category: string;
  };
  outcome?: {
    final_action: string;
    status: string;
    updated_at: string;
    final_reply_text: string | null;
  };
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  sent: { icon: Send, color: "text-success", label: "Sent" },
  drafted: { icon: Clock, color: "text-info", label: "Drafted" },
  archived: { icon: Archive, color: "text-muted-foreground", label: "Archived" },
  declined: { icon: XCircle, color: "text-destructive", label: "Declined" },
};

const categoryLabels: Record<string, string> = {
  meeting_request: "Meeting",
  action_needed: "Action",
  fyi: "FYI",
  newsletter: "Newsletter",
  other: "Other",
};

export default function History() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<HistoryMessage | null>(null);
  const [showDeleteOld, setShowDeleteOld] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          from_name,
          from_email,
          subject,
          received_at,
          classifications (category),
          outcomes (final_action, status, updated_at, final_reply_text)
        `)
        .not("outcomes", "is", null)
        .order("received_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || [])
        .filter((msg: any) => msg.outcomes && msg.outcomes.length > 0 && msg.outcomes[0].status !== "pending")
        .map((msg: any) => ({
          ...msg,
          classification: msg.classifications?.[0] || msg.classifications,
          outcome: msg.outcomes?.[0] || msg.outcomes,
        }));

      setMessages(formatted);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pendingCount = 0; // We'd need another query for this
  
  const filteredMessages = messages.filter(msg => 
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar 
        user={user}
        pendingCount={pendingCount}
        completedCount={messages.length}
        onSignOut={handleSignOut}
        onAddEmail={() => navigate("/dashboard")}
        onDeleteOld={() => setShowDeleteOld(true)}
      />
      
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">History</h1>
              <p className="text-muted-foreground">
                {messages.length} completed action{messages.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by sender, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-foreground mb-2">No history yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Completed actions will appear here.
              </p>
              <Button variant="action" asChild>
                <Link to="/dashboard">Go to Queue</Link>
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Sender
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Subject
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Category
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Action
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMessages.map((msg) => {
                  const status = msg.outcome?.status || "pending";
                  const config = statusConfig[status];
                  const StatusIcon = config?.icon || CheckCircle;
                  
                  return (
                    <tr 
                      key={msg.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {msg.from_name || msg.from_email.split("@")[0]}
                          </p>
                          <p className="text-sm text-muted-foreground">{msg.from_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-foreground truncate max-w-xs">{msg.subject}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary">
                          {categoryLabels[msg.classification?.category || "other"] || "Other"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 ${config?.color || ""}`}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">{config?.label || status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(msg.outcome?.updated_at || msg.received_at), "MMM d, yyyy")}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {selectedMessage && (
        <div className="w-96 border-l border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground">Details</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
              Close
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">From</p>
              <p className="font-medium text-foreground">{selectedMessage.from_name || selectedMessage.from_email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium text-foreground">{selectedMessage.subject}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Action Taken</p>
              <div className={`flex items-center gap-2 ${statusConfig[selectedMessage.outcome?.status || ""]?.color || ""}`}>
                {(() => {
                  const StatusIcon = statusConfig[selectedMessage.outcome?.status || ""]?.icon || CheckCircle;
                  return <StatusIcon className="w-4 h-4" />;
                })()}
                <span>{statusConfig[selectedMessage.outcome?.status || ""]?.label}</span>
              </div>
            </div>
            {selectedMessage.outcome?.final_reply_text && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reply Sent</p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {selectedMessage.outcome.final_reply_text}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

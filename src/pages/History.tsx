import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DeleteOldEmailsModal } from "@/components/dashboard/DeleteOldEmailsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { 
  Search, 
  Calendar,
  Clock,
  Send,
  Archive,
  XCircle,
  CheckCircle,
  MessageSquare,
  Trash2,
  Bot,
  User,
  ChevronRight,
  X
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

type ChatMessage = { role: "user" | "assistant"; content: string };

interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
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
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<HistoryMessage | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [showDeleteOld, setShowDeleteOld] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
    fetchChats();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id, from_name, from_email, subject, received_at,
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

  const fetchChats = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setChats((data || []).map((c: any) => ({
        ...c,
        messages: Array.isArray(c.messages) ? c.messages : [],
      })));
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setChatsLoading(false);
    }
  };

  const handleDeleteChat = async (chatId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingChatId(chatId);
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", chatId);

      if (error) throw error;

      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (selectedChat?.id === chatId) setSelectedChat(null);
      toast({ title: "Chat deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const filteredMessages = messages.filter((msg) =>
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar
        user={user}
        pendingCount={0}
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
                {messages.length} email action{messages.length !== 1 ? "s" : ""} · {chats.length} chat{chats.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="emails" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="emails" className="gap-2">
                <Send className="w-4 h-4" />
                Email Actions
              </TabsTrigger>
              <TabsTrigger value="chats" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Inbox Chats
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Email Actions Tab */}
          <TabsContent value="emails" className="flex-1 overflow-auto mt-0">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No email history yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Completed actions will appear here.</p>
                <Button variant="action" asChild>
                  <Link to="/dashboard">Go to Queue</Link>
                </Button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Sender</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Subject</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Category</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Action</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMessages.map((msg) => {
                    const status = msg.outcome?.status || "pending";
                    const config = statusConfig[status];
                    const StatusIcon = config?.icon || CheckCircle;
                    return (
                      <tr key={msg.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedMessage(msg); setSelectedChat(null); }}>
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{msg.from_name || msg.from_email.split("@")[0]}</p>
                          <p className="text-sm text-muted-foreground">{msg.from_email}</p>
                        </td>
                        <td className="px-6 py-4"><p className="text-foreground truncate max-w-xs">{msg.subject}</p></td>
                        <td className="px-6 py-4"><Badge variant="secondary">{categoryLabels[msg.classification?.category || "other"] || "Other"}</Badge></td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-2 ${config?.color || ""}`}>
                            <StatusIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">{config?.label || status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-muted-foreground">{format(new Date(msg.outcome?.updated_at || msg.received_at), "MMM d, yyyy")}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </TabsContent>

          {/* Chats Tab */}
          <TabsContent value="chats" className="flex-1 overflow-auto mt-0">
            {chatsLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading...</div>
            ) : filteredChats.length === 0 ? (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No chats yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Start a conversation in Inbox Chat and it will appear here.</p>
                <Button variant="action" asChild>
                  <Link to="/chat">Start Chatting</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredChats.map((chat) => {
                  const msgCount = chat.messages.length;
                  const lastMsg = chat.messages[msgCount - 1];
                  return (
                    <div
                      key={chat.id}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors ${
                        selectedChat?.id === chat.id ? "bg-accent/5" : ""
                      }`}
                      onClick={() => { setSelectedChat(chat); setSelectedMessage(null); }}
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{chat.title}</p>
                        {lastMsg && (
                          <p className="text-sm text-muted-foreground truncate">
                            {lastMsg.role === "assistant" ? "AI: " : "You: "}{lastMsg.content.slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(chat.updated_at), { addSuffix: true })}
                        </span>
                        <Badge variant="secondary" className="text-xs">{msgCount} msg{msgCount !== 1 ? "s" : ""}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          disabled={deletingChatId === chat.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Detail panel — email */}
      {selectedMessage && (
        <div className="w-96 border-l border-border bg-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground">Email Details</h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}><X className="w-4 h-4" /></Button>
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
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">{selectedMessage.outcome.final_reply_text}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail panel — chat */}
      {selectedChat && (
        <div className="w-[480px] border-l border-border bg-card flex flex-col h-screen">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{selectedChat.title}</h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(selectedChat.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDeleteChat(selectedChat.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedChat.messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted/50 text-foreground"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-accent-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DeleteOldEmailsModal
        open={showDeleteOld}
        onClose={() => setShowDeleteOld(false)}
        onSuccess={() => fetchMessages()}
      />
    </div>
  );
}

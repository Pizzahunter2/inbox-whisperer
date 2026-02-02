import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Calendar, RefreshCw, Link2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface ConnectedAccount {
  id: string;
  provider: string;
  status: string | null;
  updated_at: string;
}

interface SuggestedSlot {
  start: string;
  end: string;
}

export function ConnectedAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [suggestingTimes, setSuggestingTimes] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("*");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to connect accounts",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("google-oauth", {
        body: { redirectUrl: window.location.href },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { authUrl } = response.data;
      
      // Open OAuth in same window
      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Connect error:", error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to initiate OAuth",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncInbox = async () => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke("sync-gmail");

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { imported, total } = response.data;
      
      toast({
        title: "Inbox synced",
        description: `Imported ${imported} new messages out of ${total} unread`,
      });

      // Refresh accounts to show updated status
      fetchAccounts();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync inbox",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSuggestTimes = async () => {
    setSuggestingTimes(true);
    setSuggestedSlots([]);
    try {
      const response = await supabase.functions.invoke("suggest-meeting-times", {
        body: { durationMinutes: 30 },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { slots } = response.data;
      setSuggestedSlots(slots);

      if (slots.length === 0) {
        toast({
          title: "No available slots",
          description: "No free time slots found in the next 7 days",
        });
      }
    } catch (error: any) {
      console.error("Suggest times error:", error);
      toast({
        title: "Failed to suggest times",
        description: error.message || "Could not query calendar",
        variant: "destructive",
      });
    } finally {
      setSuggestingTimes(false);
    }
  };

  const gmailAccount = accounts.find(a => a.provider === "gmail");
  const calendarAccount = accounts.find(a => a.provider === "google_calendar");
  const isConnected = gmailAccount?.status === "connected" || calendarAccount?.status === "connected";

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>
          Connect your email and calendar to enable real inbox sync
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gmail Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Gmail</p>
              <p className="text-sm text-muted-foreground">
                {gmailAccount?.status === "connected" ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {gmailAccount?.status === "connected" ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              Disconnected
            </Badge>
          )}
        </div>

        {/* Google Calendar Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                {calendarAccount?.status === "connected" ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {calendarAccount?.status === "connected" ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <XCircle className="w-3 h-3" />
              Disconnected
            </Badge>
          )}
        </div>

        {/* Connect Button */}
        {!isConnected && (
          <Button 
            variant="action" 
            onClick={handleConnect} 
            disabled={connecting}
            className="w-full"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Connect Gmail + Calendar
              </>
            )}
          </Button>
        )}

        {/* Actions when connected */}
        {isConnected && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleSyncInbox} 
                disabled={syncing || gmailAccount?.status !== "connected"}
                className="flex-1"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Inbox
                  </>
                )}
              </Button>

              <Button 
                variant="outline" 
                onClick={handleSuggestTimes} 
                disabled={suggestingTimes || calendarAccount?.status !== "connected"}
                className="flex-1"
              >
                {suggestingTimes ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding times...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Suggest Meeting Times
                  </>
                )}
              </Button>
            </div>

            {/* Reconnect button */}
            <Button 
              variant="ghost" 
              onClick={handleConnect} 
              disabled={connecting}
              className="w-full text-muted-foreground"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  Reconnect accounts
                </>
              )}
            </Button>
          </div>
        )}

        {/* Suggested Time Slots */}
        {suggestedSlots.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium text-sm">Suggested Meeting Times</h4>
            <div className="space-y-2">
              {suggestedSlots.map((slot, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg bg-accent/50 text-sm"
                >
                  <p className="font-medium">
                    {format(new Date(slot.start), "EEEE, MMM d")}
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(slot.start), "h:mm a")} – {format(new Date(slot.end), "h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ConnectionStatus {
  isGmailConnected: boolean;
  isCalendarConnected: boolean;
  isConnected: boolean;
  needsReconnect: boolean;
  loading: boolean;
}

export function useGoogleConnection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>({
    isGmailConnected: false,
    isCalendarConnected: false,
    isConnected: false,
    needsReconnect: false,
    loading: true,
  });

  const checkConnection = useCallback(async () => {
    if (!user) {
      setStatus({
        isGmailConnected: false,
        isCalendarConnected: false,
        isConnected: false,
        needsReconnect: false,
        loading: false,
      });
      return;
    }

    try {
      const { data: accounts, error } = await supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error checking connection:", error);
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      const gmailAccount = accounts?.find(a => a.provider === "gmail");
      const calendarAccount = accounts?.find(a => a.provider === "google_calendar");

      const isGmailConnected = gmailAccount?.status === "connected";
      const isCalendarConnected = calendarAccount?.status === "connected";
      const isConnected = isGmailConnected || isCalendarConnected;

      // Check if tokens might be expired (needs reconnect)
      let needsReconnect = false;
      if (gmailAccount?.token_expires_at) {
        const expiresAt = new Date(gmailAccount.token_expires_at);
        const now = new Date();
        // If expired and no refresh token, needs reconnect
        if (expiresAt < now && !gmailAccount.refresh_token_encrypted) {
          needsReconnect = true;
        }
      }

      setStatus({
        isGmailConnected,
        isCalendarConnected,
        isConnected,
        needsReconnect,
        loading: false,
      });

      // If connected, auto-disable demo mode in profile
      if (isConnected) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ demo_mode: false })
          .eq("user_id", user.id);

        if (profileError) {
          console.error("Error updating demo mode:", profileError);
        }
      }
    } catch (error) {
      console.error("Error in checkConnection:", error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Listen for OAuth success messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        // Re-check connection status
        checkConnection();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [checkConnection]);

  return {
    ...status,
    refresh: checkConnection,
  };
}

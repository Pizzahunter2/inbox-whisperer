import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/pages/Dashboard";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeMessagesOptions {
  userId: string | undefined;
  onInsert: (message: Message) => void;
  onUpdate: (message: Message) => void;
}

export function useRealtimeMessages({ userId, onInsert, onUpdate }: UseRealtimeMessagesOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Use refs for callbacks so the channel doesn't re-subscribe when callbacks change
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);

  // Keep refs fresh
  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!userId) return;

    const fetchAndNotify = async (messageId: string, handler: 'insert' | 'update') => {
      const { data } = await supabase
        .from('messages')
        .select(`*, classifications (*), proposals (*), outcomes (*)`)
        .eq('id', messageId)
        .single();

      if (data) {
        const formatted: Message = {
          ...data,
          classification: data.classifications?.[0] || data.classifications,
          proposal: data.proposals?.[0] || data.proposals,
          outcome: data.outcomes?.[0] || data.outcomes,
        };
        if (handler === 'insert') {
          onInsertRef.current(formatted);
        } else {
          onUpdateRef.current(formatted);
        }
      }
    };

    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          fetchAndNotify((payload.new as any).id, 'insert');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          fetchAndNotify((payload.new as any).id, 'update');
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]); // Only depends on userId now - stable subscription
}

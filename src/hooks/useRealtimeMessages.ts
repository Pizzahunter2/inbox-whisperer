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

  useEffect(() => {
    if (!userId) return;

    // Subscribe to messages table for the current user
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
        async (payload) => {
          console.log('Realtime INSERT:', payload);
          const newMessage = payload.new as any;
          
          // Fetch related data for the new message
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              classifications (*),
              proposals (*),
              outcomes (*)
            `)
            .eq('id', newMessage.id)
            .single();

          if (data) {
            const formattedMessage: Message = {
              ...data,
              classification: data.classifications?.[0] || data.classifications,
              proposal: data.proposals?.[0] || data.proposals,
              outcome: data.outcomes?.[0] || data.outcomes,
            };
            onInsert(formattedMessage);
          }
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
        async (payload) => {
          console.log('Realtime UPDATE:', payload);
          const updatedMessage = payload.new as any;
          
          // Fetch related data for the updated message
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              classifications (*),
              proposals (*),
              outcomes (*)
            `)
            .eq('id', updatedMessage.id)
            .single();

          if (data) {
            const formattedMessage: Message = {
              ...data,
              classification: data.classifications?.[0] || data.classifications,
              proposal: data.proposals?.[0] || data.proposals,
              outcome: data.outcomes?.[0] || data.outcomes,
            };
            onUpdate(formattedMessage);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, onInsert, onUpdate]);
}

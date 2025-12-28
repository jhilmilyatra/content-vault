import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useGuestUnreadCount = (guestId: string | undefined) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!guestId) return;

    try {
      const { data, error } = await supabase.functions.invoke('guest-messages', {
        body: { action: 'getConversations', guestId }
      });

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      if (data?.success && data?.conversations) {
        const total = data.conversations.reduce(
          (acc: number, conv: { unread_count: number }) => acc + conv.unread_count,
          0
        );
        setUnreadCount(total);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [guestId]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Real-time listener for new messages
  useEffect(() => {
    if (!guestId) return;

    const channel = supabase
      .channel(`guest-unread-${guestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guest_messages',
          filter: `guest_id=eq.${guestId}`,
        },
        (payload) => {
          const newMsg = payload.new as { sender_type: string };
          if (newMsg.sender_type === 'member') {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guest_messages',
          filter: `guest_id=eq.${guestId}`,
        },
        () => {
          // Refetch on message read status changes
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestId, fetchUnreadCount]);

  return { unreadCount, refetch: fetchUnreadCount };
};

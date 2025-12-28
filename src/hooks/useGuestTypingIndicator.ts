import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GuestTypingIndicatorOptions {
  guestId: string;
  memberId: string;
}

export const useGuestTypingIndicator = ({ guestId, memberId }: GuestTypingIndicatorOptions) => {
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!guestId || !memberId) return;

    try {
      await supabase.from("typing_indicators").upsert(
        {
          user_id: guestId,
          chat_type: "guest_member",
          target_id: memberId,
          is_typing: typing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chat_type,target_id" }
      );
    } catch (error) {
      console.error("Error updating guest typing status:", error);
    }
  }, [guestId, memberId]);

  const handleInputChange = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  }, [isTyping, updateTypingStatus]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    updateTypingStatus(false);
  }, [updateTypingStatus]);

  // Subscribe to member's typing status
  useEffect(() => {
    if (!guestId || !memberId) return;

    const channel = supabase
      .channel(`guest-typing-${guestId}-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `target_id=eq.${guestId}`,
        },
        (payload: any) => {
          const data = payload.new;
          if (data && data.user_id === memberId && data.chat_type === "guest_member") {
            setRemoteTyping(data.is_typing);
            
            // Auto-clear after 3 seconds if no update
            setTimeout(() => {
              setRemoteTyping(false);
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestId, memberId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateTypingStatus(false);
    };
  }, [updateTypingStatus]);

  return {
    isTyping,
    remoteTyping,
    handleInputChange,
    stopTyping,
  };
};

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TypingIndicatorOptions {
  chatType: "guest_member" | "owner_member";
  targetId: string;
}

export const useTypingIndicator = ({ chatType, targetId }: TypingIndicatorOptions) => {
  const { user } = useAuth();
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!user || !targetId) return;

    try {
      await supabase.from("typing_indicators").upsert(
        {
          user_id: user.id,
          chat_type: chatType,
          target_id: targetId,
          is_typing: typing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chat_type,target_id" }
      );
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [user, chatType, targetId]);

  const handleInputChange = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing after 2 seconds
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

  // Subscribe to remote typing status
  useEffect(() => {
    if (!targetId) return;

    const channel = supabase
      .channel(`typing-${chatType}-${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `target_id=eq.${user?.id}`,
        },
        (payload: any) => {
          const data = payload.new;
          if (data && data.chat_type === chatType) {
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
  }, [targetId, chatType, user?.id]);

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

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TypingIndicatorOptions {
  chatType: "guest_member" | "owner_member";
  targetId: string;
}

// Throttle typing updates to reduce database writes
const TYPING_THROTTLE_MS = 800;
const TYPING_TIMEOUT_MS = 2000;
const REMOTE_TYPING_TIMEOUT_MS = 3000;

export const useTypingIndicator = ({ chatType, targetId }: TypingIndicatorOptions) => {
  const { user } = useAuth();
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTypingStatus = useCallback(async (typing: boolean) => {
    if (!user || !targetId) return;

    // Throttle updates - only send if enough time has passed or we're stopping
    const now = Date.now();
    if (typing && now - lastTypingUpdateRef.current < TYPING_THROTTLE_MS) {
      return;
    }
    lastTypingUpdateRef.current = now;

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

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, TYPING_TIMEOUT_MS);
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
    if (!targetId || !user?.id) return;

    const channel = supabase
      .channel(`typing-${chatType}-${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `target_id=eq.${user.id}`,
        },
        (payload: any) => {
          const data = payload.new;
          if (data && data.chat_type === chatType) {
            setRemoteTyping(data.is_typing);
            
            // Clear previous timeout
            if (remoteTypingTimeoutRef.current) {
              clearTimeout(remoteTypingTimeoutRef.current);
            }
            
            // Auto-clear after timeout if no update
            if (data.is_typing) {
              remoteTypingTimeoutRef.current = setTimeout(() => {
                setRemoteTyping(false);
              }, REMOTE_TYPING_TIMEOUT_MS);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
      }
    };
  }, [targetId, chatType, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
      }
      // Don't call updateTypingStatus here to avoid async issues on unmount
    };
  }, []);

  return {
    isTyping,
    remoteTyping,
    handleInputChange,
    stopTyping,
  };
};

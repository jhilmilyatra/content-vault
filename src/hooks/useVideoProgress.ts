/**
 * useVideoProgress - Hook for video resume functionality
 * 
 * Saves and loads video playback position for resume capability.
 * Works for both authenticated users (via Supabase) and guests (via edge function).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VideoProgress {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  lastWatchedAt: string;
}

interface UseVideoProgressResult {
  progress: VideoProgress | null;
  isLoading: boolean;
  saveProgress: (position: number, duration: number) => void;
  markCompleted: () => void;
}

// Debounce interval for saving progress (5 seconds)
const SAVE_INTERVAL_MS = 5000;
// Consider video complete at 95% watched
const COMPLETION_THRESHOLD = 0.95;

/**
 * Hook for authenticated users - uses Supabase directly
 */
export function useVideoProgress(
  fileId: string | undefined,
  userId: string | undefined
): UseVideoProgressResult {
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSaveRef = useRef<number>(0);
  const pendingSaveRef = useRef<{ position: number; duration: number } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!fileId || !userId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("video_progress")
          .select("position_seconds, duration_seconds, completed, last_watched_at")
          .eq("file_id", fileId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          console.error("Failed to load video progress:", error);
        } else if (data) {
          setProgress({
            positionSeconds: data.position_seconds,
            durationSeconds: data.duration_seconds,
            completed: data.completed,
            lastWatchedAt: data.last_watched_at,
          });
        }
      } catch (err) {
        console.error("Error loading video progress:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [fileId, userId]);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save any pending progress immediately on unmount
      if (pendingSaveRef.current && fileId && userId) {
        const { position, duration } = pendingSaveRef.current;
        saveProgressToDb(fileId, userId, position, duration);
      }
    };
  }, [fileId, userId]);

  // Save progress to database
  const saveProgressToDb = async (
    fId: string,
    uId: string,
    position: number,
    duration: number
  ) => {
    const completed = duration > 0 && position / duration >= COMPLETION_THRESHOLD;

    try {
      const { error } = await supabase
        .from("video_progress")
        .upsert(
          {
            user_id: uId,
            file_id: fId,
            position_seconds: position,
            duration_seconds: duration,
            completed,
            last_watched_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,file_id",
          }
        );

      if (error) {
        console.error("Failed to save video progress:", error);
      }
    } catch (err) {
      console.error("Error saving video progress:", err);
    }
  };

  // Debounced save function
  const saveProgress = useCallback(
    (position: number, duration: number) => {
      if (!fileId || !userId) return;

      const now = Date.now();
      pendingSaveRef.current = { position, duration };

      // Check if enough time has passed since last save
      if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
        lastSaveRef.current = now;
        saveProgressToDb(fileId, userId, position, duration);
        pendingSaveRef.current = null;
      } else {
        // Schedule a save for later
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            const { position: p, duration: d } = pendingSaveRef.current;
            lastSaveRef.current = Date.now();
            saveProgressToDb(fileId, userId, p, d);
            pendingSaveRef.current = null;
          }
        }, SAVE_INTERVAL_MS - (now - lastSaveRef.current));
      }
    },
    [fileId, userId]
  );

  // Mark video as completed
  const markCompleted = useCallback(async () => {
    if (!fileId || !userId) return;

    try {
      await supabase
        .from("video_progress")
        .upsert(
          {
            user_id: userId,
            file_id: fileId,
            completed: true,
            last_watched_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,file_id",
          }
        );

      setProgress((prev) =>
        prev ? { ...prev, completed: true } : null
      );
    } catch (err) {
      console.error("Error marking video complete:", err);
    }
  }, [fileId, userId]);

  return {
    progress,
    isLoading,
    saveProgress,
    markCompleted,
  };
}

/**
 * Hook for guest users - uses edge function
 */
export function useGuestVideoProgress(
  fileId: string | undefined,
  guestId: string | undefined
): UseVideoProgressResult {
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSaveRef = useRef<number>(0);
  const pendingSaveRef = useRef<{ position: number; duration: number } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!fileId || !guestId) {
        setIsLoading(false);
        return;
      }

      try {
        // Use service role via edge function for guest progress
        const { data, error } = await supabase
          .from("guest_video_progress")
          .select("position_seconds, duration_seconds, completed, last_watched_at")
          .eq("file_id", fileId)
          .eq("guest_id", guestId)
          .maybeSingle();

        if (error) {
          console.error("Failed to load guest video progress:", error);
        } else if (data) {
          setProgress({
            positionSeconds: data.position_seconds,
            durationSeconds: data.duration_seconds,
            completed: data.completed,
            lastWatchedAt: data.last_watched_at,
          });
        }
      } catch (err) {
        console.error("Error loading guest video progress:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [fileId, guestId]);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingSaveRef.current && fileId && guestId) {
        const { position, duration } = pendingSaveRef.current;
        saveProgressToDb(fileId, guestId, position, duration);
      }
    };
  }, [fileId, guestId]);

  const saveProgressToDb = async (
    fId: string,
    gId: string,
    position: number,
    duration: number
  ) => {
    const completed = duration > 0 && position / duration >= COMPLETION_THRESHOLD;

    try {
      const { error } = await supabase
        .from("guest_video_progress")
        .upsert(
          {
            guest_id: gId,
            file_id: fId,
            position_seconds: position,
            duration_seconds: duration,
            completed,
            last_watched_at: new Date().toISOString(),
          },
          {
            onConflict: "guest_id,file_id",
          }
        );

      if (error) {
        console.error("Failed to save guest video progress:", error);
      }
    } catch (err) {
      console.error("Error saving guest video progress:", err);
    }
  };

  const saveProgress = useCallback(
    (position: number, duration: number) => {
      if (!fileId || !guestId) return;

      const now = Date.now();
      pendingSaveRef.current = { position, duration };

      if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
        lastSaveRef.current = now;
        saveProgressToDb(fileId, guestId, position, duration);
        pendingSaveRef.current = null;
      } else {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          if (pendingSaveRef.current) {
            const { position: p, duration: d } = pendingSaveRef.current;
            lastSaveRef.current = Date.now();
            saveProgressToDb(fileId, guestId, p, d);
            pendingSaveRef.current = null;
          }
        }, SAVE_INTERVAL_MS - (now - lastSaveRef.current));
      }
    },
    [fileId, guestId]
  );

  const markCompleted = useCallback(async () => {
    if (!fileId || !guestId) return;

    try {
      await supabase
        .from("guest_video_progress")
        .upsert(
          {
            guest_id: guestId,
            file_id: fileId,
            completed: true,
            last_watched_at: new Date().toISOString(),
          },
          {
            onConflict: "guest_id,file_id",
          }
        );

      setProgress((prev) =>
        prev ? { ...prev, completed: true } : null
      );
    } catch (err) {
      console.error("Error marking video complete:", err);
    }
  }, [fileId, guestId]);

  return {
    progress,
    isLoading,
    saveProgress,
    markCompleted,
  };
}

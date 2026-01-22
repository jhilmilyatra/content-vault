import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedVideoStreamUrl, warmVideoStreamUrl } from "@/lib/videoStreamCache";

interface StreamUrls {
  url?: string;
  fallbackUrl?: string;
  type?: "cdn" | "vps-direct" | "mp4";
  fileInfo?: {
    id: string;
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    thumbnailUrl?: string;
  };
}

interface UseVideoStreamResult {
  streamUrl: string | null;
  fallbackUrl: string | null;
  isLoading: boolean;
  error: string | null;
  fileInfo: StreamUrls["fileInfo"] | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get MP4 streaming URLs for video playback
 * 
 * Features:
 * - Checks cache first for instant playback
 * - Automatically fetches signed CDN URLs for MP4 streaming
 * - Long TTL (12 hours) for uninterrupted playback
 * - Auto-refresh before URL expiration
 */
export function useVideoStream(
  fileId?: string,
  storagePath?: string,
  options?: {
    autoFetch?: boolean;
  }
): UseVideoStreamResult {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<StreamUrls["fileInfo"] | null>(null);

  const { autoFetch = true } = options || {};

  const fetchStreamUrls = useCallback(async () => {
    if (!fileId && !storagePath) return;

    // Check cache first for instant playback
    if (storagePath) {
      const cached = getCachedVideoStreamUrl(storagePath);
      if (cached.url) {
        console.log("📹 Using cached video stream URL");
        setStreamUrl(cached.url);
        setFallbackUrl(cached.fallbackUrl);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Use cache warming utility which also caches the result
      if (fileId && storagePath) {
        const result = await warmVideoStreamUrl(fileId, storagePath, { priority: 'high' });
        if (result) {
          setStreamUrl(result.url);
          setFallbackUrl(result.fallbackUrl || null);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to direct fetch
      const params = new URLSearchParams();
      if (fileId) params.set("id", fileId);
      if (storagePath) params.set("path", storagePath);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-stream?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get stream URL");
      }

      const data: StreamUrls = await response.json();
      
      setStreamUrl(data.url || null);
      setFallbackUrl(data.fallbackUrl || null);
      setFileInfo(data.fileInfo || null);
    } catch (err) {
      console.error("Failed to get stream URLs:", err);
      setError(err instanceof Error ? err.message : "Failed to get stream URL");
    } finally {
      setIsLoading(false);
    }
  }, [fileId, storagePath]);

  // Auto-fetch on mount/change
  useEffect(() => {
    if (autoFetch && (fileId || storagePath)) {
      fetchStreamUrls();
    }
  }, [autoFetch, fileId, storagePath, fetchStreamUrls]);

  // Auto-refresh URLs before expiration (every 11 hours for 12-hour TTL)
  useEffect(() => {
    if (!streamUrl) return;

    const refreshInterval = setInterval(() => {
      console.log("Auto-refreshing video stream URLs");
      fetchStreamUrls();
    }, 11 * 60 * 60 * 1000); // 11 hours

    return () => clearInterval(refreshInterval);
  }, [streamUrl, fetchStreamUrls]);

  return {
    streamUrl,
    fallbackUrl,
    isLoading,
    error,
    fileInfo,
    refresh: fetchStreamUrls,
  };
}

/**
 * Get a signed video stream URL (one-time call)
 */
export async function getVideoStreamUrl(
  fileId?: string,
  storagePath?: string
): Promise<StreamUrls | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Not authenticated");
    }

    const params = new URLSearchParams();
    if (fileId) params.set("id", fileId);
    if (storagePath) params.set("path", storagePath);

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-stream?${params}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

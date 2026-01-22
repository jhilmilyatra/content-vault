import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StreamUrls {
  url?: string;
  hlsUrl?: string;
  fallbackUrl?: string;
  hasHls?: boolean;
  type?: "cdn" | "vps-direct";
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
  hlsUrl: string | null;
  fallbackUrl: string | null;
  isLoading: boolean;
  error: string | null;
  preferHls: boolean;
  fileInfo: StreamUrls["fileInfo"] | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get optimal streaming URLs for video playback
 * 
 * Features:
 * - Automatically fetches signed CDN URLs
 * - Long TTL (12 hours) for uninterrupted playback
 * - Supports both MP4 direct streaming and HLS adaptive
 * - Auto-refresh before URL expiration
 */
export function useVideoStream(
  fileId?: string,
  storagePath?: string,
  options?: {
    preferHls?: boolean;
    autoFetch?: boolean;
  }
): UseVideoStreamResult {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHls, setHasHls] = useState(false);
  const [fileInfo, setFileInfo] = useState<StreamUrls["fileInfo"] | null>(null);

  const { preferHls = true, autoFetch = true } = options || {};

  const fetchStreamUrls = useCallback(async () => {
    if (!fileId && !storagePath) return;

    setIsLoading(true);
    setError(null);

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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get stream URL");
      }

      const data: StreamUrls = await response.json();
      
      setStreamUrl(data.url || null);
      setHlsUrl(data.hlsUrl || null);
      setFallbackUrl(data.fallbackUrl || null);
      setHasHls(data.hasHls || false);
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
    hlsUrl,
    fallbackUrl,
    isLoading,
    error,
    preferHls: preferHls && hasHls,
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

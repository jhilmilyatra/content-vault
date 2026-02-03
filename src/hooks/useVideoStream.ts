import { useState, useEffect, useCallback, useRef } from "react";
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

export interface VideoQualityOption {
  label: string;
  src: string;
  isOriginal?: boolean;
}

interface UseVideoStreamResult {
  streamUrl: string | null;
  fallbackUrl: string | null;
  /** Quality options for quality selector (original + 480p if available) */
  qualities: VideoQualityOption[];
  isLoading: boolean;
  error: string | null;
  fileInfo: StreamUrls["fileInfo"] | null;
  refresh: () => Promise<void>;
  /** Call this periodically during playback to keep the stream warm */
  keepAlive: () => void;
}

// Keep-alive interval (5 minutes) - prevents CDN edge cache expiry
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000;

/**
 * Hook to get MP4 streaming URLs for video playback
 * 
 * Features:
 * - Checks cache first for instant playback
 * - Automatically fetches signed CDN URLs for MP4 streaming
 * - Long TTL (12 hours) for uninterrupted playback
 * - Auto-refresh before URL expiration
 * - Keep-alive to prevent CDN cold starts during long playback
 */
export function useVideoStream(
  fileId?: string,
  storagePath?: string,
  options?: {
    autoFetch?: boolean;
    enableKeepAlive?: boolean;
  }
): UseVideoStreamResult {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [qualities, setQualities] = useState<VideoQualityOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<StreamUrls["fileInfo"] | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeepAliveRef = useRef<number>(0);

  const { autoFetch = true, enableKeepAlive = true } = options || {};

  /**
   * Keep-alive: Make a small range request to keep CDN edge cache warm
   * This prevents buffering during long videos
   */
  const keepAlive = useCallback(() => {
    if (!streamUrl) return;
    
    const now = Date.now();
    // Debounce to prevent too frequent calls
    if (now - lastKeepAliveRef.current < 60000) return;
    lastKeepAliveRef.current = now;

    // Fire-and-forget range request to keep edge cache warm
    fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-1023', // Just 1KB to ping the cache
      },
    }).catch(() => {
      // Silent fail - keep-alive is best-effort
    });
    
    console.log('🔥 Stream keep-alive ping sent');
  }, [streamUrl]);

  const fetchStreamUrls = useCallback(async () => {
    if (!fileId && !storagePath) return;

    // Check cache first for instant playback
    if (storagePath) {
      const cached = getCachedVideoStreamUrl(storagePath);
      if (cached.url) {
        console.log("📹 Using cached video stream URL");
        setStreamUrl(cached.url);
        setFallbackUrl(cached.fallbackUrl);
        // Build qualities from cache
        const qualityOptions: VideoQualityOption[] = [
          { label: 'Original', src: cached.url, isOriginal: true }
        ];
        if (cached.fallbackUrl) {
          qualityOptions.push({ label: '480p', src: cached.fallbackUrl });
        }
        setQualities(qualityOptions);
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
        const result = await warmVideoStreamUrl(fileId, storagePath, { 
          priority: 'high',
          warmEdge: true,
        });
        if (result) {
          setStreamUrl(result.url);
          setFallbackUrl(result.fallbackUrl || null);
          // Build qualities
          const qualityOptions: VideoQualityOption[] = [
            { label: 'Original', src: result.url, isOriginal: true }
          ];
          if (result.fallbackUrl) {
            qualityOptions.push({ label: '480p', src: result.fallbackUrl });
          }
          setQualities(qualityOptions);
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
      
      // Build quality options from response
      const qualityOptions: VideoQualityOption[] = [];
      if (data.url) {
        qualityOptions.push({ label: 'Original', src: data.url, isOriginal: true });
      }
      if (data.fallbackUrl) {
        qualityOptions.push({ label: '480p', src: data.fallbackUrl });
      }
      setQualities(qualityOptions);
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

  // Auto keep-alive during playback to prevent CDN cold starts
  useEffect(() => {
    if (!streamUrl || !enableKeepAlive) return;

    // Initial keep-alive after 1 minute
    const initialTimeout = setTimeout(() => {
      keepAlive();
    }, 60000);

    // Regular keep-alive every 5 minutes
    keepAliveIntervalRef.current = setInterval(() => {
      keepAlive();
    }, KEEP_ALIVE_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
    };
  }, [streamUrl, enableKeepAlive, keepAlive]);

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
    qualities,
    isLoading,
    error,
    fileInfo,
    refresh: fetchStreamUrls,
    keepAlive,
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

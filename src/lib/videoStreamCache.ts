/**
 * Video Stream Cache - Pre-warm video stream URLs after upload
 * 
 * This module provides immediate cache warming for video files after upload,
 * enabling instant playback without waiting for stream URL generation.
 */

import { supabase } from "@/integrations/supabase/client";
import { setCachedUrl, getCachedUrl } from "./urlCache";
import { toast } from "@/hooks/use-toast";

// Video stream URL cache TTL (11 hours - just under the 12h signed URL validity)
const VIDEO_STREAM_CACHE_TTL = 11 * 60 * 60 * 1000;

// In-memory preload tracking to avoid duplicate requests
const preloadingUrls = new Set<string>();

// Track which videos have been edge-warmed
const edgeWarmedUrls = new Set<string>();

/**
 * Pre-warm video stream URL for a file
 * Call this immediately after a video upload completes
 */
export async function warmVideoStreamUrl(
  fileId: string, 
  storagePath: string,
  options?: {
    priority?: 'high' | 'low';
    prefetchMetadata?: boolean;
    showToast?: boolean;
    warmEdge?: boolean;
  }
): Promise<{ url: string; fallbackUrl?: string } | null> {
  const cacheKey = `video-stream:${fileId}`;
  
  // Check if already cached
  const cached = getCachedUrl(storagePath, 'video-stream');
  if (cached) {
    console.log('📹 Video stream already cached:', fileId.substring(0, 8));
    return { url: cached };
  }
  
  // Prevent duplicate warming requests
  if (preloadingUrls.has(fileId)) {
    return null;
  }
  
  preloadingUrls.add(fileId);
  
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      console.warn('No session for video stream warming');
      return null;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ fileId, storagePath }),
      }
    );

    if (!response.ok) {
      throw new Error(`Stream URL fetch failed: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.url) {
      // Cache the video stream URL with extended TTL
      setCachedUrl(storagePath, result.url, 'video-stream', VIDEO_STREAM_CACHE_TTL);
      
      // Also cache fallback URL if available
      if (result.fallbackUrl) {
        setCachedUrl(storagePath, result.fallbackUrl, 'video-stream-fallback', VIDEO_STREAM_CACHE_TTL);
      }
      
      // Prefetch video metadata using link hints
      if (options?.prefetchMetadata !== false) {
        prefetchVideoMetadata(result.url, options?.priority);
      }
      
      // Warm the CDN edge cache with a range request (first 2MB)
      if (options?.warmEdge !== false && !edgeWarmedUrls.has(fileId)) {
        warmCdnEdgeCache(result.url, fileId);
      }
      
      console.log('🔥 Video stream warmed:', fileId.substring(0, 8));
      
      // Show toast notification for high-priority warming (after upload)
      if (options?.showToast && options?.priority === 'high') {
        toast({
          title: "Video ready for instant playback",
          description: "Stream has been pre-cached for smooth viewing",
          duration: 3000,
        });
      }
      
      return { url: result.url, fallbackUrl: result.fallbackUrl };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to warm video stream:', error);
    return null;
  } finally {
    preloadingUrls.delete(fileId);
  }
}

/**
 * Warm CDN edge cache by making a range request for first 2MB
 * This populates Cloudflare's edge cache for instant first-byte delivery
 */
async function warmCdnEdgeCache(url: string, fileId: string): Promise<void> {
  try {
    edgeWarmedUrls.add(fileId);
    
    // Request first 2MB to warm the edge cache (enough for video to start playing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-2097151', // First 2MB
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok || response.status === 206) {
      // Read and discard the response to complete the cache warming
      await response.arrayBuffer();
      console.log('🌐 CDN edge cache warmed:', fileId.substring(0, 8));
    }
  } catch (error) {
    // Silent fail - edge warming is optional optimization
    console.log('CDN edge warming skipped:', error instanceof Error ? error.message : 'unknown');
  }
}

/**
 * Prefetch video metadata using browser link hints
 * This triggers range request for video headers only
 */
function prefetchVideoMetadata(url: string, priority: 'high' | 'low' = 'low'): void {
  try {
    // Create preload link for video metadata
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = url;
    
    // Set fetch priority hint
    if (priority === 'high') {
      (link as any).fetchpriority = 'high';
    }
    
    document.head.appendChild(link);
    
    // Remove after 5 minutes (cleanup)
    setTimeout(() => {
      link.remove();
    }, 5 * 60 * 1000);
  } catch {
    // Silent fail - not critical
  }
}

/**
 * Batch warm video stream URLs for multiple files
 * Useful for warming recently uploaded files in background
 */
export async function warmVideoStreamUrls(
  files: Array<{ id: string; storagePath: string; mimeType: string }>
): Promise<void> {
  // Filter to only video files
  const videoFiles = files.filter(f => 
    f.mimeType.startsWith('video/') || 
    f.storagePath.match(/\.(mp4|mkv|webm|mov|avi)$/i)
  );
  
  if (videoFiles.length === 0) return;
  
  console.log(`📹 Warming ${videoFiles.length} video stream URLs...`);
  
  // Process in batches of 3 to avoid overwhelming the server
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 500;
  
  for (let i = 0; i < videoFiles.length; i += BATCH_SIZE) {
    const batch = videoFiles.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(file => 
        warmVideoStreamUrl(file.id, file.storagePath, { priority: 'low' })
      )
    );
    
    // Delay between batches
    if (i + BATCH_SIZE < videoFiles.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }
}

/**
 * Get cached video stream URL if available
 */
export function getCachedVideoStreamUrl(storagePath: string): {
  url: string | null;
  fallbackUrl: string | null;
} {
  return {
    url: getCachedUrl(storagePath, 'video-stream'),
    fallbackUrl: getCachedUrl(storagePath, 'video-stream-fallback'),
  };
}

/**
 * Check if a file is a video based on mime type or extension
 */
export function isVideoFile(mimeType: string, fileName?: string): boolean {
  if (mimeType.startsWith('video/')) return true;
  if (fileName) {
    return /\.(mp4|mkv|webm|mov|avi|m4v|wmv|flv)$/i.test(fileName);
  }
  return false;
}

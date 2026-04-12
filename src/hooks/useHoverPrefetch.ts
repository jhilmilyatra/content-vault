import { useRef, useCallback } from 'react';
import { vpsProcessedUrl } from '@/lib/config';
const PREFETCH_DELAY_MS = 500;
const PREFETCH_SIZE = 1 * 1024 * 1024; // 1MB

// Preload the Watch/VideoPlayer page chunk (singleton)
let watchChunkPromise: Promise<any> | null = null;
function preloadWatchChunk() {
  if (!watchChunkPromise) {
    watchChunkPromise = import('@/pages/VideoPlayer').catch(() => {});
  }
}

/**
 * Hook for hover-based prefetching of video data and route chunks.
 * On hover:
 * 1. Immediately preloads the VideoPlayer page JS chunk
 * 2. After 500ms, prefetches 1MB of the 480p video via Range request
 */
export function useHoverPrefetch() {
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedPaths = useRef<Set<string>>(new Set());

  const onHoverStart = useCallback((storagePath: string) => {
    // Step 1: Immediately preload VideoPlayer chunk
    preloadWatchChunk();

    // Step 2: After delay, prefetch video data
    if (prefetchedPaths.current.has(storagePath)) return;

    prefetchTimerRef.current = setTimeout(() => {
      const userId = storagePath.split('/')[0];
      const baseName = storagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
      const videoUrl = vpsProcessedUrl(storagePath, '480p.mp4');

      // Range request for first 1MB to warm CDN cache
      fetch(videoUrl, {
        method: 'GET',
        headers: {
          Range: `bytes=0-${PREFETCH_SIZE - 1}`,
        },
        credentials: 'include',
        priority: 'low' as RequestPriority,
      })
        .then(() => {
          prefetchedPaths.current.add(storagePath);
        })
        .catch(() => {});
    }, PREFETCH_DELAY_MS);
  }, []);

  const onHoverEnd = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  return { onHoverStart, onHoverEnd };
}

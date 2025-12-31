import { useEffect, useRef, useCallback } from 'react';
import { getCachedUrl, setCachedUrl } from '@/lib/urlCache';
import { supabase } from '@/integrations/supabase/client';

interface FileForWarming {
  id: string;
  storage_path: string;
}

// Batch size for warming requests
const BATCH_SIZE = 5;
// Delay between batches to avoid overwhelming the server
const BATCH_DELAY_MS = 500;
// How many files ahead to prefetch on scroll
const PREFETCH_AHEAD_COUNT = 10;

/**
 * Hook to pre-fetch and cache URLs for visible files
 * Includes scroll-based prefetching for upcoming files
 */
export function useCacheWarming(files: FileForWarming[], enabled: boolean = true) {
  const warmingInProgress = useRef<Set<string>>(new Set());
  const warmingQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);
  const lastPrefetchIndex = useRef(0);

  const warmUrl = useCallback(async (storagePath: string) => {
    // Skip if already cached or warming in progress
    if (getCachedUrl(storagePath, 'url') || warmingInProgress.current.has(storagePath)) {
      return;
    }

    warmingInProgress.current.add(storagePath);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=url`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        let finalUrl: string;
        
        if (result.storage === "vps") {
          finalUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=get`;
        } else {
          finalUrl = result.url;
        }
        
        setCachedUrl(storagePath, finalUrl, 'url');
        console.log('🔥 Cache warmed:', storagePath.split('/').pop());
      }
    } catch (error) {
      // Silent fail for warming - not critical
    } finally {
      warmingInProgress.current.delete(storagePath);
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing.current || warmingQueue.current.length === 0) return;
    
    isProcessing.current = true;
    
    while (warmingQueue.current.length > 0) {
      const batch = warmingQueue.current.splice(0, BATCH_SIZE);
      await Promise.all(batch.map(warmUrl));
      
      if (warmingQueue.current.length > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    isProcessing.current = false;
  }, [warmUrl]);

  const queueForWarming = useCallback((storagePaths: string[]) => {
    const newPaths = storagePaths.filter(
      path => !getCachedUrl(path, 'url') && 
              !warmingInProgress.current.has(path) &&
              !warmingQueue.current.includes(path)
    );
    
    if (newPaths.length > 0) {
      warmingQueue.current.push(...newPaths);
      processQueue();
    }
  }, [processQueue]);

  // Prefetch next batch of files based on scroll position
  const prefetchOnScroll = useCallback((visibleIndex: number) => {
    if (!enabled || files.length === 0) return;
    
    // Calculate which files to prefetch (ahead of current position)
    const startIndex = Math.max(visibleIndex, lastPrefetchIndex.current);
    const endIndex = Math.min(startIndex + PREFETCH_AHEAD_COUNT, files.length);
    
    if (startIndex >= endIndex) return;
    
    const pathsToPrefetch = files
      .slice(startIndex, endIndex)
      .map(f => f.storage_path);
    
    if (pathsToPrefetch.length > 0) {
      lastPrefetchIndex.current = endIndex;
      queueForWarming(pathsToPrefetch);
      console.log(`📜 Scroll prefetch: files ${startIndex}-${endIndex}`);
    }
  }, [enabled, files, queueForWarming]);

  // Warm cache for initial visible files when they change
  useEffect(() => {
    if (!enabled || files.length === 0) return;

    // Reset prefetch index when files change
    lastPrefetchIndex.current = 0;

    // Small delay to let the UI settle first - warm first batch
    const timeoutId = setTimeout(() => {
      const initialPaths = files.slice(0, PREFETCH_AHEAD_COUNT).map(f => f.storage_path);
      queueForWarming(initialPaths);
      lastPrefetchIndex.current = Math.min(PREFETCH_AHEAD_COUNT, files.length);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [files, enabled, queueForWarming]);

  return { queueForWarming, warmUrl, prefetchOnScroll };
}

/**
 * Hook for scroll-based cache prefetching
 * Attach to a scrollable container to trigger prefetching
 */
export function useScrollPrefetch(
  containerRef: React.RefObject<HTMLElement>,
  files: { storage_path: string }[],
  enabled: boolean = true
) {
  const { prefetchOnScroll } = useCacheWarming(
    files.map((f, i) => ({ id: String(i), storage_path: f.storage_path })),
    enabled
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      
      ticking = true;
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
        
        // When scrolled past 60%, start prefetching more
        if (scrollPercentage > 0.6) {
          const estimatedVisibleIndex = Math.floor(scrollPercentage * files.length);
          prefetchOnScroll(estimatedVisibleIndex);
        }
        
        ticking = false;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, files, enabled, prefetchOnScroll]);
}

/**
 * Warm cache for a specific set of storage paths
 * Useful for manual warming on hover or focus
 */
export async function warmCacheForPaths(storagePaths: string[]): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;

  const uncachedPaths = storagePaths.filter(path => !getCachedUrl(path, 'url'));
  
  await Promise.all(
    uncachedPaths.slice(0, BATCH_SIZE).map(async (storagePath) => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=url`,
          {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const finalUrl = result.storage === "vps"
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=get`
            : result.url;
          
          setCachedUrl(storagePath, finalUrl, 'url');
        }
      } catch {
        // Silent fail
      }
    })
  );
}

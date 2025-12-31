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

/**
 * Hook to pre-fetch and cache URLs for visible files
 * Uses IntersectionObserver to detect when files become visible
 */
export function useCacheWarming(files: FileForWarming[], enabled: boolean = true) {
  const warmingInProgress = useRef<Set<string>>(new Set());
  const warmingQueue = useRef<string[]>([]);
  const isProcessing = useRef(false);

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

  // Warm cache for all provided files when they change
  useEffect(() => {
    if (!enabled || files.length === 0) return;

    // Small delay to let the UI settle first
    const timeoutId = setTimeout(() => {
      const paths = files.map(f => f.storage_path);
      queueForWarming(paths);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [files, enabled, queueForWarming]);

  return { queueForWarming, warmUrl };
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

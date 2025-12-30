import { useState, useEffect, useRef } from 'react';
import { getCachedThumbnail, cacheThumbnail } from '@/lib/thumbnailCache';

interface UseCachedImageOptions {
  enabled?: boolean;
  priority?: boolean;
}

interface UseCachedImageResult {
  src: string | null;
  isLoading: boolean;
  isFromCache: boolean;
  error: Error | null;
}

/**
 * Hook to load images with IndexedDB caching
 */
export function useCachedImage(
  originalUrl: string | undefined | null,
  options: UseCachedImageOptions = {}
): UseCachedImageResult {
  const { enabled = true, priority = false } = options;
  
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!originalUrl || !enabled) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadImage = async () => {
      try {
        // First try to get from cache
        const cachedUrl = await getCachedThumbnail(originalUrl);
        
        if (cachedUrl) {
          if (isMounted) {
            blobUrlRef.current = cachedUrl;
            setSrc(cachedUrl);
            setIsFromCache(true);
            setIsLoading(false);
          }
          return;
        }

        // Not in cache, fetch it
        const response = await fetch(originalUrl, { credentials: 'include' });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        
        if (!isMounted) return;

        // Create blob URL
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setSrc(blobUrl);
        setIsFromCache(false);
        setIsLoading(false);

        // Cache for future use (only if under 5MB)
        if (blob.size < 5 * 1024 * 1024) {
          cacheThumbnail(originalUrl, blob).catch(() => {
            // Silently ignore cache errors
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load image'));
          setIsLoading(false);
          // Fall back to original URL
          setSrc(originalUrl);
        }
      }
    };

    if (priority) {
      loadImage();
    } else {
      // Use requestIdleCallback for non-priority images
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => loadImage(), { timeout: 2000 });
      } else {
        setTimeout(loadImage, 0);
      }
    }

    return () => {
      isMounted = false;
      // Clean up blob URL when component unmounts
      if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [originalUrl, enabled, priority]);

  return { src, isLoading, isFromCache, error };
}

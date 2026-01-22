import { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToProcessing, 
  isProcessingThumbnail, 
  getProcessingFiles 
} from '@/lib/thumbnailProcessing';

/**
 * Hook to track thumbnail processing state for files
 * Re-renders component when processing state changes
 */
export function useThumbnailProcessing() {
  const [processingIds, setProcessingIds] = useState<Set<string>>(
    () => new Set(getProcessingFiles())
  );

  useEffect(() => {
    // Subscribe to processing state changes
    const unsubscribe = subscribeToProcessing((fileId, isProcessing) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        if (isProcessing) {
          next.add(fileId);
        } else {
          next.delete(fileId);
        }
        return next;
      });
    });

    return unsubscribe;
  }, []);

  const isProcessing = useCallback(
    (fileId: string) => processingIds.has(fileId),
    [processingIds]
  );

  return {
    isProcessing,
    processingIds: Array.from(processingIds),
    processingCount: processingIds.size,
  };
}

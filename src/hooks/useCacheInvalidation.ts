import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearThumbnailCache } from '@/lib/thumbnailCache';
import { toast } from 'sonner';

/**
 * Hook that listens for cache invalidation broadcasts from the owner
 * When a broadcast is received, it clears the local thumbnail cache
 */
export function useCacheInvalidation() {
  useEffect(() => {
    const channel = supabase
      .channel('cache-invalidation')
      .on('broadcast', { event: 'clear-cache' }, async (payload) => {
        console.log('📢 Received cache invalidation broadcast:', payload);
        
        try {
          await clearThumbnailCache();
          toast.info('Cache cleared by administrator', {
            description: 'Your local thumbnail cache has been refreshed.',
            duration: 4000,
          });
        } catch (error) {
          console.error('Failed to clear cache on broadcast:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to cache invalidation channel');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}

/**
 * Broadcast a cache invalidation signal to all connected clients
 */
export async function broadcastCacheInvalidation(): Promise<boolean> {
  try {
    const channel = supabase.channel('cache-invalidation');
    
    await channel.subscribe();
    
    await channel.send({
      type: 'broadcast',
      event: 'clear-cache',
      payload: {
        timestamp: new Date().toISOString(),
        reason: 'owner-initiated',
      },
    });

    // Clean up channel after sending
    setTimeout(() => {
      supabase.removeChannel(channel);
    }, 1000);

    return true;
  } catch (error) {
    console.error('Failed to broadcast cache invalidation:', error);
    return false;
  }
}

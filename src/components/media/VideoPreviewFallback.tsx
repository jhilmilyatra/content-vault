import { useRef, useEffect, memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { vpsProcessedUrl } from '@/lib/config';

interface VideoPreviewFallbackProps {
  /** Storage path for the video */
  storagePath: string;
  /** Whether to play the preview */
  isPlaying: boolean;
  /** CSS class */
  className?: string;
}

/**
 * VideoPreviewFallback - Shows a muted video preview when no sprite is available.
 * Loads the 480p transcoded version for efficiency.
 */
export const VideoPreviewFallback = memo(function VideoPreviewFallback({
  storagePath,
  isPlaying,
  className,
}: VideoPreviewFallbackProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Construct 480p URL
  const userId = storagePath.split('/')[0];
  const baseName = storagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  const previewUrl = vpsProcessedUrl(storagePath, '480p.mp4');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      // Set source and start loading
      if (!video.src) {
        video.src = previewUrl;
        video.load();
      }
      
      const handleCanPlay = () => {
        setIsReady(true);
        video.play().catch(() => {});
      };

      video.addEventListener('canplay', handleCanPlay, { once: true });
      
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
      };
    } else {
      // Pause and reset
      video.pause();
      setIsReady(false);
    }
  }, [isPlaying, previewUrl]);

  // Auto-stop after 10 seconds
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      videoRef.current?.pause();
    }, 10000);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      loop
      preload="none"
      className={cn(
        'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
        isReady && isPlaying ? 'opacity-100' : 'opacity-0',
        className
      )}
    />
  );
});

export default VideoPreviewFallback;

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { vpsProcessedUrl } from '@/lib/config';

interface SpritePreviewProps {
  /** File ID used to construct sprite URL */
  fileId: string;
  /** Storage path for the video */
  storagePath: string;
  /** Whether the preview is active (hovering) */
  isPlaying: boolean;
  /** CSS class */
  className?: string;
  /** Number of frames in the sprite strip */
  frameCount?: number;
  /** Width of each frame in pixels */
  frameWidth?: number;
  /** Total animation duration in ms */
  animationDuration?: number;
}

/**
 * SpritePreview - Displays a 10-frame horizontal sprite strip animation
 * on hover. Sprites are preloaded only on hover (not on mount).
 */
export const SpritePreview = memo(function SpritePreview({
  fileId,
  storagePath,
  isPlaying,
  className,
  frameCount = 10,
  frameWidth = 320,
  animationDuration = 3000,
}: SpritePreviewProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef(false);

  // Construct sprite URL from storage path
  const spriteUrl = vpsProcessedUrl(storagePath, 'sprite.webp');

  // Preload sprite only when hover starts (not on mount)
  useEffect(() => {
    if (!isPlaying || preloadedRef.current) return;

    const img = new Image();
    img.onload = () => {
      preloadedRef.current = true;
      setIsLoaded(true);
    };
    img.onerror = () => {
      setHasError(true);
    };
    img.src = spriteUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isPlaying, spriteUrl]);

  // Animate frames when playing
  useEffect(() => {
    if (!isPlaying || !isLoaded) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentFrame(0);
      return;
    }

    const frameInterval = animationDuration / frameCount;
    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frameCount);
    }, frameInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, isLoaded, frameCount, animationDuration]);

  if (hasError || (!isLoaded && !isPlaying)) return null;

  // Loading state while sprite loads on hover
  if (isPlaying && !isLoaded) {
    return (
      <div className={cn('absolute inset-0 flex items-center justify-center bg-black/20', className)}>
        <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
      </div>
    );
  }

  if (!isLoaded) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden transition-opacity duration-200',
        isPlaying ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        backgroundImage: `url(${spriteUrl})`,
        backgroundSize: `${frameCount * 100}% 100%`,
        backgroundPositionX: `${-(currentFrame * 100)}%`,
        backgroundPositionY: '0',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
});

export default SpritePreview;

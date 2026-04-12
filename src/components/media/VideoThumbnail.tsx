import { useState, useRef, useEffect, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { FileVideo, Play } from "lucide-react";
import { getCachedThumbnail, cacheThumbnail } from "@/lib/thumbnailCache";
import { thumbnailQueue } from "@/lib/thumbnailQueue";
import { getAdaptiveRootMargin } from "@/hooks/useDeviceCapability";
import { SpritePreview } from "./SpritePreview";
import { VideoPreviewFallback } from "./VideoPreviewFallback";

interface VideoThumbnailProps {
  thumbnailUrl?: string | null;
  animatedPreviewUrl?: string | null;
  fallbackUrl?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  showPlayIndicator?: boolean;
  /** Priority loading (first 6 items) */
  priority?: boolean;
  /** High priority (first 2 items) - uses fetchpriority="high" */
  highPriority?: boolean;
  /** Storage path for sprite/video preview */
  storagePath?: string;
  /** File ID for sprite preview */
  fileId?: string;
  /** Enable hover preview (sprite or video fallback) */
  enableHoverPreview?: boolean;
  onClick?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const aspectRatioClasses = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "",
};

export const VideoThumbnail = memo(function VideoThumbnail({
  thumbnailUrl,
  animatedPreviewUrl,
  fallbackUrl,
  alt,
  className,
  containerClassName,
  aspectRatio = "square",
  showPlayIndicator = true,
  priority = false,
  highPriority = false,
  storagePath,
  fileId,
  enableHoverPreview = false,
  onClick,
  onHoverStart,
  onHoverEnd,
}: VideoThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [spriteError, setSpriteError] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isTouchDeviceRef = useRef(false);
  const tapCountRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveThumbnailUrl = thumbnailUrl || fallbackUrl;
  const hasAnimatedPreview = !!animatedPreviewUrl;
  const canShowSpritePreview = enableHoverPreview && storagePath && !spriteError;
  const canShowVideoFallback = enableHoverPreview && storagePath && spriteError;

  // Adaptive IntersectionObserver for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const rootMargin = getAdaptiveRootMargin();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Load thumbnail via queue with caching
  useEffect(() => {
    if (!isInView || !effectiveThumbnailUrl) return;

    let isMounted = true;

    const loadThumbnail = async () => {
      try {
        // Try IndexedDB cache first
        const cached = await getCachedThumbnail(effectiveThumbnailUrl);
        if (cached && isMounted) {
          blobUrlRef.current = cached;
          setCachedSrc(cached);
          setIsLoaded(true);
          return;
        }

        // Use thumbnail queue for concurrency control
        const queuePriority = highPriority ? 'high' : priority ? 'normal' : 'low';
        const blobUrl = await thumbnailQueue.enqueue(effectiveThumbnailUrl, queuePriority);
        
        if (!isMounted) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }

        if (blobUrl) {
          blobUrlRef.current = blobUrl;
          setCachedSrc(blobUrl);
          setIsLoaded(true);

          // Cache in IndexedDB for future use
          try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            if (blob.size < 5 * 1024 * 1024) {
              cacheThumbnail(effectiveThumbnailUrl, blob).catch(() => {});
            }
          } catch {}
        } else {
          // Fallback to direct URL
          setCachedSrc(effectiveThumbnailUrl);
          setHasError(true);
        }
      } catch {
        if (isMounted) {
          setCachedSrc(effectiveThumbnailUrl);
          setHasError(true);
        }
      }
    };

    loadThumbnail();

    return () => {
      isMounted = false;
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [isInView, effectiveThumbnailUrl, priority, highPriority]);

  // Touch device handling: first tap = preview, second tap = navigate
  const handleTouchStart = useCallback(() => {
    isTouchDeviceRef.current = true;
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (isTouchDeviceRef.current) return;
    setIsHovering(true);
    onHoverStart?.();

    // Auto-stop preview after 10 seconds
    autoStopTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, 10000);
  }, [onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    onHoverEnd?.();
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, [onHoverEnd]);

  const handleClick = useCallback(() => {
    if (isTouchDeviceRef.current) {
      tapCountRef.current++;
      if (tapCountRef.current === 1) {
        // First tap: show preview
        setIsHovering(true);
        autoStopTimerRef.current = setTimeout(() => {
          setIsHovering(false);
          tapCountRef.current = 0;
        }, 10000);
        return;
      }
      // Second tap: navigate
      tapCountRef.current = 0;
      setIsHovering(false);
    }
    onClick?.();
  }, [onClick]);

  // Cleanup auto-stop timer
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, []);

  // No thumbnail available - show fallback icon
  if (!effectiveThumbnailUrl) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center",
          aspectRatioClasses[aspectRatio],
          containerClassName
        )}
        onClick={onClick}
      >
        <FileVideo className="w-8 h-8 text-violet-400" />
        {showPlayIndicator && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-black/40 group",
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      {/* Skeleton loader - CSS only, no framer-motion */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/10" />
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <FileVideo className="w-8 h-8 text-violet-400/50 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/10 to-purple-500/10">
          <FileVideo className="w-8 h-8 text-violet-400/50" />
        </div>
      )}

      {/* Static thumbnail */}
      {isInView && !hasError && cachedSrc && (
        <img
          src={cachedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={highPriority ? "high" : undefined}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? (isHovering && (canShowSpritePreview || canShowVideoFallback || (hasAnimatedPreview)) ? "opacity-0" : "opacity-100") : "opacity-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Sprite preview on hover */}
      {canShowSpritePreview && isHovering && storagePath && (
        <SpritePreview
          fileId={fileId || ''}
          storagePath={storagePath}
          isPlaying={isHovering}
          className="z-20"
        />
      )}

      {/* Video preview fallback when sprite fails */}
      {canShowVideoFallback && isHovering && storagePath && (
        <VideoPreviewFallback
          storagePath={storagePath}
          isPlaying={isHovering}
          className="z-20"
        />
      )}

      {/* Animated preview (legacy - shown on hover if provided) */}
      {isInView && hasAnimatedPreview && isHovering && (
        <img
          src={animatedPreviewUrl!}
          alt={`${alt} preview`}
          className={cn("absolute inset-0 w-full h-full object-cover z-20", className)}
        />
      )}

      {/* Play indicator overlay */}
      {showPlayIndicator && isLoaded && !isHovering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoThumbnail;

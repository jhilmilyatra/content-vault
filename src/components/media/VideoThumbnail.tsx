import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { FileVideo, Play } from "lucide-react";
import { getCachedThumbnail, cacheThumbnail } from "@/lib/thumbnailCache";

interface VideoThumbnailProps {
  /** Static thumbnail URL */
  thumbnailUrl?: string | null;
  /** Animated GIF preview URL (for hover effect) */
  animatedPreviewUrl?: string | null;
  /** Fallback URL if no thumbnail */
  fallbackUrl?: string;
  /** Alt text for the image */
  alt: string;
  /** Additional class names */
  className?: string;
  /** Container class names */
  containerClassName?: string;
  /** Aspect ratio */
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  /** Whether to show play indicator overlay */
  showPlayIndicator?: boolean;
  /** Priority loading (skip lazy load) */
  priority?: boolean;
  /** On click handler */
  onClick?: () => void;
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
  onClick,
}: VideoThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [animatedLoaded, setAnimatedLoaded] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Determine the actual thumbnail URL to use
  const effectiveThumbnailUrl = thumbnailUrl || fallbackUrl;
  const hasAnimatedPreview = !!animatedPreviewUrl;

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "300px", // Start loading 300px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Load thumbnail with caching
  useEffect(() => {
    if (!isInView || !effectiveThumbnailUrl) return;

    let isMounted = true;

    const loadThumbnail = async () => {
      try {
        // Try to get from cache first
        const cached = await getCachedThumbnail(effectiveThumbnailUrl);
        if (cached && isMounted) {
          blobUrlRef.current = cached;
          setCachedSrc(cached);
          setIsLoaded(true);
          return;
        }

        // Fetch the thumbnail
        const response = await fetch(effectiveThumbnailUrl, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch');
        
        const blob = await response.blob();
        if (!isMounted) return;

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setCachedSrc(blobUrl);
        setIsLoaded(true);

        // Cache for future use (only thumbnails under 5MB)
        if (blob.size < 5 * 1024 * 1024) {
          cacheThumbnail(effectiveThumbnailUrl, blob).catch(() => {});
        }
      } catch {
        if (isMounted) {
          // Fall back to direct URL
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
  }, [isInView, effectiveThumbnailUrl]);

  // Preload animated preview when hovering
  useEffect(() => {
    if (!isHovering || !animatedPreviewUrl || animatedLoaded) return;

    const img = new Image();
    img.src = animatedPreviewUrl;
    img.onload = () => setAnimatedLoaded(true);
  }, [isHovering, animatedPreviewUrl, animatedLoaded]);

  const handleMouseEnter = () => {
    if (hasAnimatedPreview) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

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
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Skeleton loader */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10"
          >
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/10" />
            
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0"
              animate={{
                backgroundPosition: ["200% 0", "-200% 0"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />

            {/* Centered video icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileVideo className="w-8 h-8 text-violet-400/50" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/10 to-purple-500/10">
          <FileVideo className="w-8 h-8 text-violet-400/50" />
        </div>
      )}

      {/* Static thumbnail */}
      {isInView && !hasError && cachedSrc && (
        <motion.img
          src={cachedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={isLoaded ? { opacity: isHovering && animatedLoaded ? 0 : 1, scale: 1 } : { opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3 }}
          className={cn("w-full h-full object-cover", className)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Animated preview (shown on hover) */}
      {isInView && hasAnimatedPreview && isHovering && animatedLoaded && (
        <motion.img
          src={animatedPreviewUrl}
          alt={`${alt} preview`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("absolute inset-0 w-full h-full object-cover", className)}
        />
      )}

      {/* Play indicator overlay */}
      {showPlayIndicator && isLoaded && !isHovering && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
        </motion.div>
      )}

      {/* Hover indicator for animated preview */}
      {isHovering && hasAnimatedPreview && !animatedLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white/80"
          />
        </div>
      )}
    </div>
  );
});

export default VideoThumbnail;

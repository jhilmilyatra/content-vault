import { useState, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { getCachedThumbnail, cacheThumbnail } from "@/lib/thumbnailCache";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  placeholderColor?: string;
  blurHash?: string;
  priority?: boolean;
  /** Enable IndexedDB caching */
  enableCache?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

function generatePlaceholder(color: string = "rgba(255,255,255,0.05)"): string {
  return `linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.1) 100%)`;
}

// Aspect ratio mappings
const aspectRatioClasses = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "",
};

/**
 * LazyImage - Optimized for smooth scrolling with CSS-only transitions
 * No framer-motion to prevent jitter during scroll
 */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "auto",
  placeholderColor,
  priority = false,
  enableCache = true,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Intersection Observer for lazy loading - larger margin for smoother experience
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
        rootMargin: "400px", // Start loading 400px before viewport for smoother scroll
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Check cache and preload image when in view
  useEffect(() => {
    if (!isInView || !src) return;

    let isMounted = true;

    const loadImage = async () => {
      // Try to get from cache first (instant display)
      if (enableCache) {
        try {
          const cached = await getCachedThumbnail(src);
          if (cached && isMounted) {
            blobUrlRef.current = cached;
            setCachedSrc(cached);
            // Small delay for smooth transition
            requestAnimationFrame(() => {
              if (isMounted) {
                setIsLoaded(true);
                onLoad?.();
              }
            });
            return;
          }
        } catch {
          // Continue to fetch if cache fails
        }
      }

      // Fetch the image with high priority for visible items
      try {
        const response = await fetch(src, { 
          credentials: 'include',
          priority: priority ? 'high' : 'auto' as RequestPriority,
        });
        if (!response.ok) throw new Error('Failed to fetch');
        
        const blob = await response.blob();
        if (!isMounted) return;

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setCachedSrc(blobUrl);
        
        // Use requestAnimationFrame for smooth transition
        requestAnimationFrame(() => {
          if (isMounted) {
            setIsLoaded(true);
            onLoad?.();
          }
        });

        // Cache for future use (only images under 5MB)
        if (enableCache && blob.size < 5 * 1024 * 1024) {
          cacheThumbnail(src, blob).catch(() => {});
        }
      } catch {
        // Fall back to direct src on error
        if (isMounted) {
          setCachedSrc(src);
          const img = new Image();
          img.src = src;
          img.onload = () => {
            if (isMounted) {
              setIsLoaded(true);
              onLoad?.();
            }
          };
          img.onerror = () => {
            if (isMounted) {
              setHasError(true);
              onError?.();
            }
          };
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Clean up blob URL
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [isInView, src, enableCache, onLoad, onError, priority]);

  const placeholder = generatePlaceholder(placeholderColor);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-muted/30",
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
    >
      {/* Static placeholder - no animation during scroll */}
      <div
        className={cn(
          "absolute inset-0 z-10 transition-opacity duration-300",
          isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{ background: placeholder }}
      />

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <div className="text-center text-muted-foreground">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs">Failed to load</span>
          </div>
        </div>
      )}

      {/* Actual image - CSS transition only, no JS animation */}
      {isInView && !hasError && cachedSrc && (
        <img
          src={cachedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
        />
      )}
    </div>
  );
});

/**
 * LazyThumbnail - Lightweight version for small thumbnails
 * Pure CSS transitions, no framer-motion
 */
export const LazyThumbnail = memo(function LazyThumbnail({
  src,
  alt,
  size = 48,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/30 flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Static shimmer placeholder */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: "linear-gradient(135deg, hsl(var(--muted)/0.5) 0%, hsl(var(--muted)/0.2) 100%)",
          }}
        />
      )}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
});

/**
 * LazyBackground - Background image with lazy loading
 * Pure CSS transitions
 */
export const LazyBackground = memo(function LazyBackground({
  src,
  className,
  children,
  overlayClassName,
}: {
  src: string;
  className?: string;
  children?: React.ReactNode;
  overlayClassName?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.src = src;
            img.onload = () => setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "100px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {/* Placeholder gradient */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isLoaded ? "opacity-0" : "opacity-100"
        )}
        style={{
          background: "linear-gradient(135deg, hsl(var(--muted)/0.3) 0%, hsl(var(--background)) 100%)",
        }}
      />
      
      {/* Background image - CSS transition */}
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundImage: `url(${src})` }}
      />
      
      {/* Optional overlay */}
      {overlayClassName && <div className={cn("absolute inset-0", overlayClassName)} />}
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
});

export default LazyImage;

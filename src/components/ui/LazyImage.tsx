import { useState, useRef, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { getCachedThumbnail, cacheThumbnail } from "@/lib/thumbnailCache";
import { thumbnailQueue } from "@/lib/thumbnailQueue";
import { getAdaptiveRootMargin } from "@/hooks/useDeviceCapability";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  placeholderColor?: string;
  blurHash?: string;
  priority?: boolean;
  highPriority?: boolean;
  enableCache?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

function generatePlaceholder(color: string = "rgba(255,255,255,0.05)"): string {
  return `linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.1) 100%)`;
}

const aspectRatioClasses = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "",
};

/**
 * LazyImage - Optimized with concurrency queue and adaptive loading
 */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "auto",
  placeholderColor,
  priority = false,
  highPriority = false,
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

  // Adaptive IntersectionObserver
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

  // Load image via queue with caching
  useEffect(() => {
    if (!isInView || !src) return;

    let isMounted = true;

    const loadImage = async () => {
      // Try IndexedDB cache first
      if (enableCache) {
        try {
          const cached = await getCachedThumbnail(src);
          if (cached && isMounted) {
            blobUrlRef.current = cached;
            setCachedSrc(cached);
            requestAnimationFrame(() => {
              if (isMounted) {
                setIsLoaded(true);
                onLoad?.();
              }
            });
            return;
          }
        } catch {}
      }

      // Use thumbnail queue for concurrency control
      try {
        const queuePriority = highPriority ? 'high' : priority ? 'normal' : 'low';
        const blobUrl = await thumbnailQueue.enqueue(src, queuePriority);

        if (!isMounted) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }

        if (blobUrl) {
          blobUrlRef.current = blobUrl;
          setCachedSrc(blobUrl);
          requestAnimationFrame(() => {
            if (isMounted) {
              setIsLoaded(true);
              onLoad?.();
            }
          });

          // Cache for future use
          if (enableCache) {
            try {
              const response = await fetch(blobUrl);
              const blob = await response.blob();
              if (blob.size < 5 * 1024 * 1024) {
                cacheThumbnail(src, blob).catch(() => {});
              }
            } catch {}
          }
        } else {
          // Fallback to direct src
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
      } catch {
        if (isMounted) {
          setCachedSrc(src);
          setHasError(true);
          onError?.();
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (blobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [isInView, src, enableCache, onLoad, onError, priority, highPriority]);

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
      {/* Static placeholder */}
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
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Failed to load</span>
          </div>
        </div>
      )}

      {/* Image with CSS transition */}
      {isInView && !hasError && cachedSrc && (
        <img
          src={cachedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={highPriority ? "high" : undefined}
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
    const rootMargin = getAdaptiveRootMargin();
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
      { rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isLoaded ? "opacity-0" : "opacity-100"
        )}
        style={{
          background: "linear-gradient(135deg, hsl(var(--muted)/0.3) 0%, hsl(var(--background)) 100%)",
        }}
      />
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        style={{ backgroundImage: `url(${src})` }}
      />
      {overlayClassName && <div className={cn("absolute inset-0", overlayClassName)} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
});

export default LazyImage;

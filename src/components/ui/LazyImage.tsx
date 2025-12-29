import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  placeholderColor?: string;
  blurHash?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

// Generate a tiny placeholder gradient based on average color
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

export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "auto",
  placeholderColor,
  blurHash,
  priority = false,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        rootMargin: "200px", // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Preload image when in view
  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setIsLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      setHasError(true);
      onError?.();
    };
  }, [isInView, src, onLoad, onError]);

  const placeholder = generatePlaceholder(placeholderColor);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-white/[0.02]",
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
    >
      {/* Blur placeholder */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10"
            style={{ background: placeholder }}
          >
            {/* Animated shimmer effect */}
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
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />
            
            {/* Optional blur hash preview */}
            {blurHash && (
              <div
                className="absolute inset-0 backdrop-blur-xl"
                style={{
                  backgroundImage: `url(${blurHash})`,
                  backgroundSize: "cover",
                  filter: "blur(20px)",
                  transform: "scale(1.1)",
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
          <div className="text-center text-white/30">
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

      {/* Actual image */}
      {isInView && !hasError && (
        <motion.img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "w-full h-full object-cover",
            className
          )}
          onLoad={() => {
            setIsLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            setHasError(true);
            onError?.();
          }}
        />
      )}
    </div>
  );
});

// Lightweight version for thumbnails
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
        "relative overflow-hidden rounded-lg bg-white/[0.03] flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Shimmer placeholder */}
      {!isLoaded && !hasError && (
        <motion.div
          className="absolute inset-0"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          }}
        />
      )}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/20">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
        </div>
      ) : (
        <motion.img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-cover"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
});

// Background image with lazy loading
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
          background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.1) 100%)",
        }}
      />
      
      {/* Background image */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={isLoaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
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

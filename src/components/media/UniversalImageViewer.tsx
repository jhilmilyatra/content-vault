import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ZoomIn, ZoomOut, RotateCw, Maximize, Minimize, X } from "lucide-react";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";

interface UniversalImageViewerProps {
  src: string;
  alt: string;
  className?: string;
  showControls?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

// Optimized easing curves per design guidelines
const EASE_SMOOTH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const EASE_SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };

export function UniversalImageViewer({
  src,
  alt,
  className = "",
  showControls = true,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
}: UniversalImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const isMobile = useIsMobile();
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  
  // Motion values for smooth pan
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  
  // Touch gesture state
  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  
  // Double-tap zoom state
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  
  // Swipe navigation
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartRef = useRef<{ x: number; time: number } | null>(null);
  
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;
  const DOUBLE_TAP_ZOOM = 2.5;

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const animationDuration = prefersReducedMotion ? 0 : 0.25;

  // Reset pan when zoom returns to 1
  useEffect(() => {
    if (zoom <= 1) {
      animate(panX, 0, { duration: animationDuration, ease: EASE_SMOOTH });
      animate(panY, 0, { duration: animationDuration, ease: EASE_SMOOTH });
    }
  }, [zoom, panX, panY, animationDuration]);

  // Reset on image change
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    panX.set(0);
    panY.set(0);
    setSwipeOffset(0);
  }, [src, panX, panY]);

  // Show/hide zoom indicator
  useEffect(() => {
    if (zoom !== 1) {
      setShowZoomIndicator(true);
      const timer = setTimeout(() => setShowZoomIndicator(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [zoom]);

  // Constrain pan to image bounds
  const constrainPan = useCallback((newPanX: number, newPanY: number, currentZoom: number) => {
    if (!containerRef.current || currentZoom <= 1) {
      return { x: 0, y: 0 };
    }
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Calculate max pan based on how much the image extends beyond container
    const maxPanX = Math.max(0, (containerRect.width * (currentZoom - 1)) / 2);
    const maxPanY = Math.max(0, (containerRect.height * (currentZoom - 1)) / 2);
    
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, newPanX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newPanY)),
    };
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      if (newZoom <= 1) {
        animate(panX, 0, { duration: 0.2, ease: EASE_SMOOTH });
        animate(panY, 0, { duration: 0.2, ease: EASE_SMOOTH });
      }
      return newZoom;
    });
  }, [panX, panY]);

  // Handle double-tap/click to zoom
  const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
    lightHaptic();
    
    if (zoom > 1) {
      // Zoom out to fit
      setZoom(1);
      animate(panX, 0, { duration: animationDuration, ease: EASE_SMOOTH });
      animate(panY, 0, { duration: animationDuration, ease: EASE_SMOOTH });
    } else {
      // Zoom in to tap point
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const tapX = clientX - rect.left;
        const tapY = clientY - rect.top;
        
        // Pan so tap point becomes center
        const newPanX = (centerX - tapX) * (DOUBLE_TAP_ZOOM - 1);
        const newPanY = (centerY - tapY) * (DOUBLE_TAP_ZOOM - 1);
        
        const constrained = constrainPan(newPanX, newPanY, DOUBLE_TAP_ZOOM);
        
        setZoom(DOUBLE_TAP_ZOOM);
        animate(panX, constrained.x, { duration: animationDuration, ease: EASE_SMOOTH });
        animate(panY, constrained.y, { duration: animationDuration, ease: EASE_SMOOTH });
      }
    }
  }, [zoom, panX, panY, constrainPan, animationDuration]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      pinchStartRef.current = { distance, zoom };
      panStartRef.current = null;
      swipeStartRef.current = null;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      
      // Check for double-tap
      if (lastTapRef.current) {
        const timeDiff = now - lastTapRef.current.time;
        const distX = Math.abs(touch.clientX - lastTapRef.current.x);
        const distY = Math.abs(touch.clientY - lastTapRef.current.y);
        
        if (timeDiff < 280 && distX < 30 && distY < 30) {
          handleDoubleTap(touch.clientX, touch.clientY);
          lastTapRef.current = null;
          return;
        }
      }
      
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      
      if (zoom > 1) {
        // Pan start (only when zoomed in)
        panStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          panX: panX.get(),
          panY: panY.get(),
        };
        setIsPanning(true);
      } else if (hasPrev || hasNext) {
        // Swipe navigation start
        swipeStartRef.current = { x: touch.clientX, time: now };
      }
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY, time: now };
    }
  }, [zoom, panX, panY, handleDoubleTap, hasPrev, hasNext]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const scale = distance / pinchStartRef.current.distance;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartRef.current.zoom * scale));
      setZoom(newZoom);
      
      if (newZoom <= 1) {
        panX.set(0);
        panY.set(0);
      }
    } else if (e.touches.length === 1 && panStartRef.current && zoom > 1) {
      // Pan
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStartRef.current.x;
      const deltaY = touch.clientY - panStartRef.current.y;
      
      const newPanX = panStartRef.current.panX + deltaX;
      const newPanY = panStartRef.current.panY + deltaY;
      
      const constrained = constrainPan(newPanX, newPanY, zoom);
      panX.set(constrained.x);
      panY.set(constrained.y);
    } else if (e.touches.length === 1 && swipeStartRef.current && zoom <= 1) {
      // Swipe navigation preview
      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeStartRef.current.x;
      
      // Add resistance at edges
      let offset = deltaX;
      if ((deltaX > 0 && !hasPrev) || (deltaX < 0 && !hasNext)) {
        offset = deltaX * 0.3; // Rubber band effect
      }
      setSwipeOffset(offset);
    }
  }, [zoom, panX, panY, constrainPan, hasPrev, hasNext]);

  const handleTouchEnd = useCallback(() => {
    pinchStartRef.current = null;
    panStartRef.current = null;
    setIsPanning(false);
    
    // Handle swipe navigation
    if (swipeStartRef.current && zoom <= 1) {
      const threshold = 80;
      if (swipeOffset > threshold && hasPrev && onNavigatePrev) {
        lightHaptic();
        onNavigatePrev();
      } else if (swipeOffset < -threshold && hasNext && onNavigateNext) {
        lightHaptic();
        onNavigateNext();
      }
    }
    setSwipeOffset(0);
    swipeStartRef.current = null;
    
    // Snap back if zoomed out too much
    if (zoom < 1) {
      setZoom(1);
      animate(panX, 0, { duration: animationDuration, ease: EASE_SMOOTH });
      animate(panY, 0, { duration: animationDuration, ease: EASE_SMOOTH });
    }
  }, [zoom, panX, panY, swipeOffset, hasPrev, hasNext, onNavigatePrev, onNavigateNext, animationDuration]);

  // Mouse handlers for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panX.get(),
        panY: panY.get(),
      };
      setIsPanning(true);
    }
  }, [zoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panStartRef.current && isPanning && zoom > 1) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      
      const newPanX = panStartRef.current.panX + deltaX;
      const newPanY = panStartRef.current.panY + deltaY;
      
      const constrained = constrainPan(newPanX, newPanY, zoom);
      panX.set(constrained.x);
      panY.set(constrained.y);
    }
  }, [isPanning, zoom, panX, panY, constrainPan]);

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    handleDoubleTap(e.clientX, e.clientY);
  }, [handleDoubleTap]);

  const handleZoomIn = useCallback(() => {
    lightHaptic();
    setZoom(prev => Math.min(MAX_ZOOM, prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    lightHaptic();
    const newZoom = Math.max(MIN_ZOOM, zoom - 0.5);
    setZoom(newZoom);
    if (newZoom <= 1) {
      animate(panX, 0, { duration: 0.2, ease: EASE_SMOOTH });
      animate(panY, 0, { duration: 0.2, ease: EASE_SMOOTH });
    }
  }, [zoom, panX, panY]);

  const handleRotate = useCallback(() => {
    lightHaptic();
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const toggleFullscreen = useCallback(() => {
    mediumHaptic();
    setIsFullscreen(prev => !prev);
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isFullscreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      
      switch (e.code) {
        case 'Escape':
          toggleFullscreen();
          break;
        case 'Equal':
        case 'NumpadAdd':
          handleZoomIn();
          break;
        case 'Minus':
        case 'NumpadSubtract':
          handleZoomOut();
          break;
        case 'KeyR':
          handleRotate();
          break;
        case 'ArrowLeft':
          if (hasPrev && onNavigatePrev) {
            lightHaptic();
            onNavigatePrev();
          }
          break;
        case 'ArrowRight':
          if (hasNext && onNavigateNext) {
            lightHaptic();
            onNavigateNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, hasPrev, hasNext, onNavigatePrev, onNavigateNext, handleZoomIn, handleZoomOut, handleRotate, toggleFullscreen]);

  // Cleanup
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const transform = useTransform(
    [panX, panY],
    ([x, y]) => `translate(${x}px, ${y}px) scale(${zoom}) rotate(${rotation}deg)`
  );

  return (
    <>
      <motion.div 
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          x: swipeOffset * 0.5 
        }}
        transition={{ duration: animationDuration, ease: EASE_SMOOTH }}
        className={`relative flex items-center justify-center overflow-hidden select-none will-change-transform ${
          isFullscreen 
            ? 'fixed inset-0 z-[9999] bg-black' 
            : 'flex-1 rounded-xl'
        } ${className}`}
        style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <motion.img
          ref={imageRef}
          src={src}
          alt={alt}
          className={`max-w-full max-h-[75vh] object-contain will-change-transform ${
            isFullscreen ? 'max-h-screen' : ''
          }`}
          style={{ transform }}
          draggable={false}
        />
        
        {/* Zoom level indicator */}
        <AnimatePresence>
          {showZoomIndicator && zoom !== 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: EASE_SMOOTH }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-medium"
            >
              {Math.round(zoom * 100)}%
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating controls */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: animationDuration, ease: EASE_SMOOTH }}
            className={`absolute top-4 right-4 flex items-center gap-2 ${isFullscreen ? 'z-[10001] safe-area-inset' : ''}`}
          >
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:bg-black/80 transition-colors disabled:opacity-30 touch-manipulation"
            >
              <ZoomOut className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:bg-black/80 transition-colors disabled:opacity-30 touch-manipulation"
            >
              <ZoomIn className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={handleRotate}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:bg-black/80 transition-colors touch-manipulation"
            >
              <RotateCw className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.12 }}
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 active:bg-black/80 transition-colors touch-manipulation"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </motion.button>
          </motion.div>
        )}

        {/* Fullscreen close button */}
        <AnimatePresence>
          {isFullscreen && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.15 }}
              onClick={toggleFullscreen}
              className="absolute top-4 left-4 z-[10001] w-12 h-12 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/90 active:bg-black transition-colors touch-manipulation safe-area-inset"
            >
              <X className="w-6 h-6" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Navigation hints */}
        <AnimatePresence>
          {(hasPrev || hasNext) && zoom <= 1 && !isMobile && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 bottom-16 flex justify-center gap-2 pointer-events-none"
            >
              <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/60 text-xs">
                Swipe to navigate
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swipe progress indicator for mobile */}
        <AnimatePresence>
          {swipeOffset !== 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: Math.min(1, Math.abs(swipeOffset) / 80) }}
              exit={{ opacity: 0 }}
              className={`absolute top-1/2 -translate-y-1/2 ${swipeOffset > 0 ? 'left-4' : 'right-4'} pointer-events-none`}
            >
              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
                {swipeOffset > 0 ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

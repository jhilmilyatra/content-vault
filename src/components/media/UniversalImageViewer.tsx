import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ZoomIn, ZoomOut, RotateCw, Maximize, Minimize, X } from "lucide-react";
import { lightHaptic } from "@/lib/haptics";

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
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  // Motion values for smooth pan
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  
  // Touch gesture state
  const lastTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  
  // Double-tap zoom state
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;
  const DOUBLE_TAP_ZOOM = 2.5;

  // Reset pan when zoom returns to 1
  useEffect(() => {
    if (zoom <= 1) {
      animate(panX, 0, { duration: 0.3 });
      animate(panY, 0, { duration: 0.3 });
    }
  }, [zoom, panX, panY]);

  // Reset on image change
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    panX.set(0);
    panY.set(0);
  }, [src, panX, panY]);

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
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      if (newZoom <= 1) {
        animate(panX, 0, { duration: 0.2 });
        animate(panY, 0, { duration: 0.2 });
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
      animate(panX, 0, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
      animate(panY, 0, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
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
        animate(panX, constrained.x, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
        animate(panY, constrained.y, { duration: 0.3, ease: [0.32, 0.72, 0, 1] });
      }
    }
  }, [zoom, panX, panY, constrainPan]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      pinchStartRef.current = { distance, zoom };
      panStartRef.current = null;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      
      // Check for double-tap
      if (lastTapRef.current) {
        const timeDiff = now - lastTapRef.current.time;
        const distX = Math.abs(touch.clientX - lastTapRef.current.x);
        const distY = Math.abs(touch.clientY - lastTapRef.current.y);
        
        if (timeDiff < 300 && distX < 30 && distY < 30) {
          handleDoubleTap(touch.clientX, touch.clientY);
          lastTapRef.current = null;
          return;
        }
      }
      
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      
      // Pan start (only when zoomed in)
      if (zoom > 1) {
        panStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          panX: panX.get(),
          panY: panY.get(),
        };
        setIsPanning(true);
      }
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY, time: now };
    }
  }, [zoom, panX, panY, handleDoubleTap]);

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
    } else if (e.touches.length === 1 && lastTouchRef.current && zoom <= 1) {
      // Swipe navigation (only when not zoomed)
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0 && hasPrev && onNavigatePrev) {
          onNavigatePrev();
          lastTouchRef.current = null;
        } else if (deltaX < 0 && hasNext && onNavigateNext) {
          onNavigateNext();
          lastTouchRef.current = null;
        }
      }
    }
  }, [zoom, panX, panY, constrainPan, hasPrev, hasNext, onNavigatePrev, onNavigateNext]);

  const handleTouchEnd = useCallback(() => {
    pinchStartRef.current = null;
    panStartRef.current = null;
    setIsPanning(false);
    
    // Snap back if zoomed out too much
    if (zoom < 1) {
      setZoom(1);
      animate(panX, 0, { duration: 0.3 });
      animate(panY, 0, { duration: 0.3 });
    }
  }, [zoom, panX, panY]);

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

  const handleZoomIn = () => {
    lightHaptic();
    setZoom(prev => Math.min(MAX_ZOOM, prev + 0.5));
  };

  const handleZoomOut = () => {
    lightHaptic();
    const newZoom = Math.max(MIN_ZOOM, zoom - 0.5);
    setZoom(newZoom);
    if (newZoom <= 1) {
      animate(panX, 0, { duration: 0.2 });
      animate(panY, 0, { duration: 0.2 });
    }
  };

  const handleRotate = () => {
    lightHaptic();
    setRotation(prev => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    lightHaptic();
    setIsFullscreen(prev => !prev);
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

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
          if (hasPrev && onNavigatePrev) onNavigatePrev();
          break;
        case 'ArrowRight':
          if (hasNext && onNavigateNext) onNavigateNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, hasPrev, hasNext, onNavigatePrev, onNavigateNext]);

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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative flex items-center justify-center overflow-hidden select-none ${
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
          className={`max-w-full max-h-[75vh] object-contain transition-none ${
            isFullscreen ? 'max-h-screen' : ''
          }`}
          style={{ transform }}
          draggable={false}
        />
        
        {/* Zoom level indicator */}
        <AnimatePresence>
          {zoom !== 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-medium"
            >
              {Math.round(zoom * 100)}%
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating controls */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute top-4 right-4 flex items-center gap-2 ${isFullscreen ? 'z-[10001]' : ''}`}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 touch-manipulation"
            >
              <ZoomOut className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 touch-manipulation"
            >
              <ZoomIn className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRotate}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all touch-manipulation"
            >
              <RotateCw className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all touch-manipulation"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </motion.button>
          </motion.div>
        )}

        {/* Fullscreen close button */}
        {isFullscreen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleFullscreen}
            className="absolute top-4 left-4 z-[10001] w-12 h-12 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/90 transition-all touch-manipulation"
          >
            <X className="w-6 h-6" />
          </motion.button>
        )}

        {/* Navigation hints */}
        {(hasPrev || hasNext) && zoom <= 1 && (
          <div className="absolute inset-x-0 bottom-16 flex justify-center gap-2 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white/60 text-xs">
              Swipe to navigate
            </span>
          </div>
        )}
      </motion.div>
    </>
  );
}

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Sparkles
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoPlayerProps {
  src: string;
  onError?: () => void;
  className?: string;
  /** Set to true for cross-origin sources that support CORS, false for proxied/guest URLs */
  crossOrigin?: boolean;
}

// Optimized easing curves per design guidelines
const EASE_SMOOTH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const EASE_SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };

export function VideoPlayer({ src, onError, className = "", crossOrigin = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [buffered, setBuffered] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  const [fullscreenIndicator, setFullscreenIndicator] = useState(false);
  
  // Double-tap seek
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right' | 'center'; visible: boolean }>({ side: 'left', visible: false });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Gesture controls (volume on right, brightness on left)
  const [gestureActive, setGestureActive] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [gestureIndicator, setGestureIndicator] = useState<{ type: 'volume' | 'brightness'; value: number; visible: boolean }>({ type: 'volume', value: 1, visible: false });
  const gestureStartRef = useRef<{ x: number; y: number; startVolume: number; startBrightness: number } | null>(null);

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Detect reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Auto-hide controls - adjusted timing for mobile
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, isMobile ? 4000 : 3000);
  }, [isMobile, isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      document.body.style.overflow = '';
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const video = videoRef.current;
      if (!video) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const newVol = Math.min(volume + 0.1, 1);
            video.volume = newVol;
            setVolume(newVol);
            setIsMuted(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const newVol = Math.max(volume - 0.1, 0);
            video.volume = newVol;
            setVolume(newVol);
            if (newVol === 0) setIsMuted(true);
          }
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isPlaying, isFullscreen]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lightHaptic();
      if (isPlaying) {
        video.pause();
      } else {
        video.play().catch(err => {
          console.error('Playback error:', err);
          setMediaError('Unable to play this file. The format may not be supported.');
        });
      }
      setIsPlaying(!isPlaying);
      resetControlsTimeout();
    }
  }, [isPlaying, resetControlsTimeout]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lightHaptic();
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (video) {
      const newVolume = value[0];
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      const { videoWidth, videoHeight } = video;
      if (videoWidth && videoHeight) {
        setIsPortraitVideo(videoHeight > videoWidth);
      }
    }
  }, []);

  const handleMediaEnded = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
  }, []);

  const handleMediaError = useCallback(() => {
    setMediaError('Unable to play this file. The format may not be supported by your browser.');
    onError?.();
  }, [onError]);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lightHaptic();
      video.currentTime = Math.min(video.currentTime + 10, duration);
    }
  }, [duration]);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      lightHaptic();
      video.currentTime = Math.max(video.currentTime - 10, 0);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    mediumHaptic();
    setIsFullscreen(prev => !prev);
    setFullscreenIndicator(true);
    setTimeout(() => setFullscreenIndicator(false), 600);
    
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isFullscreen]);

  const changePlaybackSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (video) {
      lightHaptic();
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  }, []);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Handle double-tap seek / fullscreen
  const handleVideoTap = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const relativeX = x / rect.width;
    
    // Define zones: left 30%, center 40%, right 30%
    const zone = relativeX < 0.3 ? 'left' : relativeX > 0.7 ? 'right' : 'center';

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const prevRelativeX = lastTapRef.current.x / rect.width;
      const prevZone = prevRelativeX < 0.3 ? 'left' : prevRelativeX > 0.7 ? 'right' : 'center';
      
      // Double-tap in same zone
      if (zone === prevZone) {
        if (zone === 'left') {
          video.currentTime = Math.max(video.currentTime - 10, 0);
          setSeekIndicator({ side: 'left', visible: true });
          setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 400);
        } else if (zone === 'right') {
          video.currentTime = Math.min(video.currentTime + 10, duration);
          setSeekIndicator({ side: 'right', visible: true });
          setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 400);
        } else {
          // Center double-tap = toggle fullscreen
          setSeekIndicator({ side: 'center', visible: true });
          setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 400);
          toggleFullscreen();
        }
        lastTapRef.current = null;
        return;
      }
    }

    lastTapRef.current = { time: now, x };
    
    setTimeout(() => {
      if (lastTapRef.current && now === lastTapRef.current.time) {
        togglePlay();
        lastTapRef.current = null;
      }
    }, 280);
  }, [duration, toggleFullscreen, togglePlay]);

  // Gesture handlers
  const handleGestureStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const isRightSide = x > rect.width * 0.6;
    const isLeftSide = x < rect.width * 0.4;
    
    if (isRightSide || isLeftSide) {
      gestureStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        startVolume: volume,
        startBrightness: brightness,
      };
    }
  }, [volume, brightness]);

  const handleGestureMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!gestureStartRef.current) return;
    
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const startX = gestureStartRef.current.x - rect.left;
    const deltaY = gestureStartRef.current.y - touch.clientY;
    
    if (Math.abs(deltaY) < 15 && !gestureActive) return;
    
    const isRightSide = startX > rect.width * 0.6;
    const isLeftSide = startX < rect.width * 0.4;
    
    if (!isRightSide && !isLeftSide) {
      gestureStartRef.current = null;
      return;
    }
    
    setGestureActive(true);
    
    const sensitivity = 200;
    const change = deltaY / sensitivity;
    
    if (isRightSide) {
      const newVolume = Math.max(0, Math.min(1, gestureStartRef.current.startVolume + change));
      const video = videoRef.current;
      if (video) {
        video.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
      }
      setGestureIndicator({ type: 'volume', value: newVolume, visible: true });
    } else {
      const newBrightness = Math.max(0.2, Math.min(1.5, gestureStartRef.current.startBrightness + change));
      setBrightness(newBrightness);
      setGestureIndicator({ type: 'brightness', value: newBrightness, visible: true });
    }
  }, [gestureActive]);

  const handleGestureEnd = useCallback(() => {
    gestureStartRef.current = null;
    setGestureActive(false);
    setTimeout(() => setGestureIndicator(prev => ({ ...prev, visible: false })), 600);
  }, []);

  // Animation durations based on design guidelines
  const animationDuration = prefersReducedMotion ? 0 : 0.18;

  if (mediaError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">{mediaError}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: animationDuration }}
      className={`relative w-full bg-black overflow-hidden will-change-transform ${
        isFullscreen 
          ? 'fixed inset-0 z-[9999] rounded-none flex items-center justify-center' 
          : isPortraitVideo 
            ? 'aspect-[9/16] max-h-[70vh] mx-auto'
            : 'aspect-video'
      } rounded-xl sm:rounded-2xl ${className}`}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
      onTouchStart={(e) => {
        resetControlsTimeout();
        handleGestureStart(e);
      }}
      onTouchMove={handleGestureMove}
      onTouchEnd={handleGestureEnd}
    >
      {/* Brightness overlay - GPU optimized */}
      <div 
        className="absolute inset-0 bg-black pointer-events-none z-[1] will-change-opacity"
        style={{ opacity: 1 - brightness }}
      />
      
      {/* Gesture indicator */}
      <AnimatePresence mode="wait">
        {gestureIndicator.visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: animationDuration, ease: EASE_SMOOTH }}
            className={`absolute top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none ${
              gestureIndicator.type === 'volume' ? 'right-8' : 'left-8'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
              {gestureIndicator.type === 'volume' ? (
                gestureIndicator.value === 0 ? <VolumeX className="w-7 h-7 text-white" /> : <Volume2 className="w-7 h-7 text-white" />
              ) : (
                <Sparkles className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="w-1.5 h-24 bg-white/20 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute bottom-0 left-0 right-0 bg-white rounded-full will-change-transform"
                initial={false}
                animate={{ 
                  height: `${gestureIndicator.type === 'volume' 
                    ? gestureIndicator.value * 100 
                    : ((gestureIndicator.value - 0.2) / 1.3) * 100}%` 
                }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-white text-xs font-semibold">
              {Math.round(gestureIndicator.value * 100)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Video element */}
      <div 
        className={`relative cursor-pointer z-[2] touch-manipulation ${
          isFullscreen 
            ? isPortraitVideo 
              ? 'h-full max-w-[56.25vh] mx-auto flex items-center justify-center' 
              : 'w-full h-full flex items-center justify-center'
            : 'w-full h-full'
        }`}
        onClick={!gestureActive ? handleVideoTap : undefined}
        onTouchEnd={!gestureActive ? handleVideoTap : undefined}
      >
        <video
          ref={videoRef}
          src={src}
          className={`object-contain will-change-transform ${
            isFullscreen && isPortraitVideo ? 'h-full w-auto max-h-screen' : 'w-full h-full'
          }`}
          style={{ filter: `brightness(${brightness})` }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleMediaEnded}
          onError={handleMediaError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          crossOrigin={crossOrigin ? "anonymous" : undefined}
          preload="metadata"
          controlsList="nodownload"
        />
        
        {/* Double-tap seek indicators */}
        <AnimatePresence mode="wait">
          {seekIndicator.visible && seekIndicator.side !== 'center' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: EASE_SMOOTH }}
              className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-none ${
                seekIndicator.side === 'left' ? 'left-[15%]' : 'right-[15%]'
              }`}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
                {seekIndicator.side === 'left' ? (
                  <SkipBack className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                ) : (
                  <SkipForward className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                )}
              </div>
              <span className="text-white text-sm font-semibold drop-shadow-lg">
                {seekIndicator.side === 'left' ? '-10s' : '+10s'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen indicator */}
        <AnimatePresence mode="wait">
          {fullscreenIndicator && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: EASE_SMOOTH }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
            >
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center">
                {isFullscreen ? (
                  <Maximize className="w-8 h-8 text-white" />
                ) : (
                  <Minimize className="w-8 h-8 text-white" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Center play button */}
        <AnimatePresence mode="wait">
          {!isPlaying && !seekIndicator.visible && !fullscreenIndicator && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: animationDuration, ease: EASE_SMOOTH }}
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none"
            >
              <motion.div 
                whileHover={{ scale: 1.05 }}
                transition={EASE_SPRING}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl"
              >
                <Play className="w-8 h-8 sm:w-10 sm:h-10 text-black ml-1" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls overlay */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ 
            opacity: showControls ? 1 : 0, 
            y: showControls ? 0 : 8,
          }}
          transition={{ duration: 0.2, ease: EASE_SMOOTH }}
          style={{ pointerEvents: showControls ? 'auto' : 'none' }}
          className={`absolute inset-x-0 bottom-0 ${isFullscreen ? 'z-[10000]' : ''}`}
        >
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent ${isFullscreen ? '' : 'backdrop-blur-sm'}`} />
          
          <div className="relative p-3 sm:p-4 safe-area-bottom">
            {/* Progress bar */}
            <div className="mb-3 relative">
              <div className="absolute inset-0 h-1.5 rounded-full bg-white/10" />
              <div 
                className="absolute h-1.5 rounded-full bg-white/20 will-change-transform"
                style={{ width: `${(buffered / duration) * 100}%` }}
              />
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer touch-manipulation relative z-10 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 sm:[&_[role=slider]]:h-4 sm:[&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-white"
              />
              <div className="flex justify-between text-xs text-white/80 mt-2 sm:hidden font-medium tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 sm:gap-2">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  onClick={skipBackward}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:bg-white/25 transition-colors touch-manipulation"
                >
                  <SkipBack className="w-5 h-5" />
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  onClick={togglePlay}
                  className="w-12 h-12 sm:w-11 sm:h-11 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 active:bg-white/35 transition-colors touch-manipulation"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  onClick={skipForward}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:bg-white/25 transition-colors touch-manipulation"
                >
                  <SkipForward className="w-5 h-5" />
                </motion.button>

                <span className="hidden sm:inline text-white/80 text-sm ml-3 font-medium tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Playback speed */}
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="h-10 px-3 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:bg-white/25 transition-colors touch-manipulation"
                  >
                    {playbackSpeed}x
                  </motion.button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: EASE_SMOOTH }}
                        className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden min-w-[80px] z-50 shadow-xl"
                      >
                        {playbackSpeeds.map((speed) => (
                          <button
                            key={speed}
                            onClick={() => changePlaybackSpeed(speed)}
                            className={`w-full px-4 py-3 text-sm text-left hover:bg-white/20 active:bg-white/25 transition-colors touch-manipulation ${
                              playbackSpeed === speed ? 'text-primary bg-white/10' : 'text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Volume (desktop) */}
                <div className="hidden sm:flex items-center gap-2 group">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20 h-10 w-10 rounded-full"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <div className="w-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={handleVolumeChange}
                    />
                  </div>
                </div>

                {/* Mobile mute */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="sm:hidden text-white hover:bg-white/20 active:bg-white/25 h-11 w-11 rounded-full touch-manipulation"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>

                {/* Fullscreen */}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  onClick={toggleFullscreen}
                  className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:bg-white/25 transition-colors touch-manipulation"
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Fullscreen close button */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: showControls ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            className="absolute top-4 right-4 z-[10001] w-12 h-12 sm:w-11 sm:h-11 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/90 active:bg-black transition-colors touch-manipulation safe-area-inset shadow-lg"
          >
            <X className="w-6 h-6 sm:w-5 sm:h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

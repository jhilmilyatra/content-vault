import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoPlayerProps {
  src: string;
  fallbackSrc?: string; // Fallback URL if primary fails
  onError?: () => void;
  /** Time update callback (fires every second) */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Video ended callback */
  onEnded?: () => void;
  /** Initial playback position in seconds */
  initialTime?: number;
  className?: string;
  /** Set to true for cross-origin sources that support CORS, false for proxied/guest URLs */
  crossOrigin?: boolean;
  /** Poster image URL */
  poster?: string;
  /** Preload strategy: "none" | "metadata" | "auto" */
  preload?: "none" | "metadata" | "auto";
}

export function VideoPlayer({ 
  src, 
  fallbackSrc, 
  onError,
  onTimeUpdate,
  onEnded,
  initialTime,
  className = "", 
  crossOrigin = true,
  poster,
  preload = "auto"
}: VideoPlayerProps) {
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
  const [useFallback, setUseFallback] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true); // Start with buffering state
  const [canPlayThrough, setCanPlayThrough] = useState(false);
  
  // Double-tap seek
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right' | 'center'; visible: boolean }>({ side: 'left', visible: false });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Auto-hide controls
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

  // Preload video source via link hint for faster initial buffering
  useEffect(() => {
    if (!src) return;
    
    // Create preload link for primary source
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'video';
    preloadLink.href = src;
    preloadLink.crossOrigin = crossOrigin ? 'anonymous' : undefined;
    document.head.appendChild(preloadLink);

    // Also preload fallback if available
    let fallbackLink: HTMLLinkElement | null = null;
    if (fallbackSrc) {
      fallbackLink = document.createElement('link');
      fallbackLink.rel = 'preload';
      fallbackLink.as = 'video';
      fallbackLink.href = fallbackSrc;
      fallbackLink.crossOrigin = crossOrigin ? 'anonymous' : undefined;
      document.head.appendChild(fallbackLink);
    }

    return () => {
      preloadLink.remove();
      fallbackLink?.remove();
    };
  }, [src, fallbackSrc, crossOrigin]);

  // Reset state when source changes
  useEffect(() => {
    setCurrentSrc(src);
    setUseFallback(false);
    setMediaError(null);
    setRetryCount(0);
    setIsBuffering(true);
    setCanPlayThrough(false);
  }, [src]);

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
        case 'Comma': // < key
        case 'Period': // > key
          e.preventDefault();
          {
            const currentIndex = playbackSpeeds.indexOf(playbackSpeed);
            if (e.code === 'Comma' && currentIndex > 0) {
              // Decrease speed
              const newSpeed = playbackSpeeds[currentIndex - 1];
              video.playbackRate = newSpeed;
              setPlaybackSpeed(newSpeed);
            } else if (e.code === 'Period' && currentIndex < playbackSpeeds.length - 1) {
              // Increase speed
              const newSpeed = playbackSpeeds[currentIndex + 1];
              video.playbackRate = newSpeed;
              setPlaybackSpeed(newSpeed);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, isPlaying, isFullscreen, playbackSpeed]);

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
      // Fire external callback
      if (onTimeUpdate && video.duration) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      const { videoWidth, videoHeight } = video;
      if (videoWidth && videoHeight) {
        setIsPortraitVideo(videoHeight > videoWidth);
      }
      // Seek to initial time if provided
      if (initialTime && initialTime > 0 && video.duration > initialTime) {
        video.currentTime = initialTime;
      }
    }
  }, [initialTime]);

  const handleMediaEnded = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
    onEnded?.();
  }, [onEnded]);

  const handleMediaError = useCallback(() => {
    const video = videoRef.current;
    const errorCode = video?.error?.code;
    const errorMessage = video?.error?.message || '';
    
    console.error(`Video error: code=${errorCode}, message=${errorMessage}, src=${currentSrc?.substring(0, 100)}`);
    
    // Format errors and decode errors - immediately try fallback (don't retry same source)
    if (errorCode === MediaError.MEDIA_ERR_DECODE || 
        (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && errorMessage.toLowerCase().includes('format'))) {
      console.log('Format/decode error detected, trying fallback immediately');
      if (fallbackSrc && !useFallback) {
        console.log('Switching to fallback source:', fallbackSrc?.substring(0, 80));
        setUseFallback(true);
        setCurrentSrc(fallbackSrc);
        setRetryCount(0);
        setIsBuffering(true);
        return;
      }
    }
    
    // Network errors - retry with exponential backoff
    if (errorCode === MediaError.MEDIA_ERR_NETWORK && retryCount < MAX_RETRIES) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
      console.log(`Network error, retrying in ${delay}ms (${retryCount + 1}/${MAX_RETRIES})...`);
      setRetryCount(prev => prev + 1);
      setIsBuffering(true);
      
      setTimeout(() => {
        if (video) {
          // Reset video element and reload
          video.load();
        }
      }, delay);
      return;
    }
    
    // Source errors (often CORS or 404) - try fallback first
    if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      // Try fallback if available
      if (fallbackSrc && !useFallback) {
        console.log('Source not supported, trying fallback:', fallbackSrc?.substring(0, 80));
        setUseFallback(true);
        setCurrentSrc(fallbackSrc);
        setRetryCount(0);
        setIsBuffering(true);
        return;
      }
    }
    
    // Try fallback if available (last resort)
    if (fallbackSrc && !useFallback) {
      console.log('Primary source failed, trying fallback:', fallbackSrc);
      setUseFallback(true);
      setCurrentSrc(fallbackSrc);
      setRetryCount(0);
      return;
    }
    
    // Build user-friendly error message
    let displayError = 'Unable to play this file. Please try again or download it.';
    if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
      displayError = 'Connection lost. Please check your network and try again.';
    } else if (errorCode === MediaError.MEDIA_ERR_DECODE) {
      displayError = 'This video could not be decoded. The file may be corrupted.';
    } else if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      displayError = 'This video format is not supported by your browser.';
    }
    
    setMediaError(displayError);
    onError?.();
  }, [onError, fallbackSrc, useFallback, retryCount, currentSrc]);

  // Buffering handlers
  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleCanPlayThrough = useCallback(() => {
    setCanPlayThrough(true);
    setIsBuffering(false);
  }, []);

  const handleCanPlay = useCallback(() => {
    // Allow playback once we can play, even if not fully buffered
    setIsBuffering(false);
  }, []);

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

  // Handle double-tap seek
  const handleVideoTap = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const relativeX = x / rect.width;
    
    const zone = relativeX < 0.3 ? 'left' : relativeX > 0.7 ? 'right' : 'center';

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const prevRelativeX = lastTapRef.current.x / rect.width;
      const prevZone = prevRelativeX < 0.3 ? 'left' : prevRelativeX > 0.7 ? 'right' : 'center';
      
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

  const handleRetry = useCallback(() => {
    setMediaError(null);
    setRetryCount(0);
    setIsBuffering(true);
    setCurrentSrc(src);
    setUseFallback(false);
  }, [src]);

  if (mediaError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <X className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-destructive font-medium mb-2">Playback Error</p>
          <p className="text-muted-foreground text-sm">{mediaError}</p>
        </div>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Fullscreen mode - fixed overlay
  if (isFullscreen) {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
        style={{ height: '100dvh' }}
        onMouseMove={resetControlsTimeout}
        onClick={resetControlsTimeout}
      >
        {/* Close button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Video container */}
        <div 
          className="w-full h-full flex items-center justify-center touch-manipulation"
          onClick={handleVideoTap}
          onTouchEnd={handleVideoTap}
        >
          <video
            ref={videoRef}
            src={currentSrc}
            poster={poster}
            className={`max-w-full max-h-full object-contain ${
              isPortraitVideo ? 'h-full w-auto' : 'w-full h-auto'
            }`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleMediaEnded}
            onError={handleMediaError}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onCanPlay={handleCanPlay}
            onCanPlayThrough={handleCanPlayThrough}
            playsInline
            crossOrigin={crossOrigin ? "anonymous" : undefined}
            preload={preload}
            controlsList="nodownload"
          />
        </div>

        {/* Buffering indicator */}
        <AnimatePresence>
          {isBuffering && isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Double-tap indicators */}
        <AnimatePresence>
          {seekIndicator.visible && seekIndicator.side !== 'center' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`absolute top-1/2 -translate-y-1/2 z-40 ${
                seekIndicator.side === 'left' ? 'left-8' : 'right-8'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                {seekIndicator.side === 'left' ? (
                  <SkipBack className="w-8 h-8 text-white" />
                ) : (
                  <SkipForward className="w-8 h-8 text-white" />
                )}
              </div>
              <p className="text-white text-xs text-center mt-2">10s</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-8"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer touch-manipulation"
                />
                <div className="flex justify-between text-xs text-white/60 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={skipBackward} className="text-white p-2">
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button onClick={togglePlay} className="text-white p-2">
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
                  </button>
                  <button onClick={skipForward} className="text-white p-2">
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Speed */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="text-white text-sm px-2 py-1"
                    >
                      {playbackSpeed}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg overflow-hidden">
                        {playbackSpeeds.map(speed => (
                          <button
                            key={speed}
                            onClick={() => changePlaybackSpeed(speed)}
                            className={`block w-full px-4 py-2 text-sm text-left hover:bg-white/10 ${
                              playbackSpeed === speed ? 'text-primary' : 'text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Volume */}
                  <button onClick={toggleMute} className="text-white p-2">
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  {/* Exit fullscreen */}
                  <button onClick={toggleFullscreen} className="text-white p-2">
                    <Minimize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Inline mode - video doesn't control layout
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden rounded-xl ${className}`}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Video - fills container, doesn't dictate size */}
      <div 
        className="w-full h-full flex items-center justify-center touch-manipulation"
        onClick={handleVideoTap}
        onTouchEnd={handleVideoTap}
      >
        <video
          ref={videoRef}
          src={currentSrc}
          poster={poster}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleMediaEnded}
          onError={handleMediaError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={handleCanPlay}
          onCanPlayThrough={handleCanPlayThrough}
          playsInline
          crossOrigin={crossOrigin ? "anonymous" : undefined}
          preload={preload}
          controlsList="nodownload"
        />
      </div>

      {/* Buffering indicator */}
      <AnimatePresence>
        {isBuffering && isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double-tap indicators */}
      <AnimatePresence>
        {seekIndicator.visible && seekIndicator.side !== 'center' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute top-1/2 -translate-y-1/2 z-40 ${
              seekIndicator.side === 'left' ? 'left-4' : 'right-4'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              {seekIndicator.side === 'left' ? (
                <SkipBack className="w-6 h-6 text-white" />
              ) : (
                <SkipForward className="w-6 h-6 text-white" />
              )}
            </div>
            <p className="text-white text-xs text-center mt-1">10s</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/pause overlay */}
      <AnimatePresence>
        {!isPlaying && showControls && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3"
          >
            {/* Progress bar */}
            <div className="mb-2">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer touch-manipulation"
              />
              <div className="flex justify-between text-xs text-white/60 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="text-white p-1.5">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={skipBackward} className="text-white p-1.5 hidden sm:block">
                  <SkipBack className="w-4 h-4" />
                </button>
                <button onClick={skipForward} className="text-white p-1.5 hidden sm:block">
                  <SkipForward className="w-4 h-4" />
                </button>
                <span className="text-white/60 text-xs ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Speed */}
                <div className="relative hidden sm:block">
                  <button 
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-white text-xs px-2 py-1"
                  >
                    {playbackSpeed}x
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg overflow-hidden z-50">
                      {playbackSpeeds.map(speed => (
                        <button
                          key={speed}
                          onClick={() => changePlaybackSpeed(speed)}
                          className={`block w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 ${
                            playbackSpeed === speed ? 'text-primary' : 'text-white'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Volume (desktop) */}
                <div className="hidden sm:flex items-center gap-1">
                  <button onClick={toggleMute} className="text-white p-1.5">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="w-16"
                  />
                </div>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="text-white p-1.5">
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * HLSPlayer - Adaptive streaming video player using hls.js
 * 
 * Features:
 * - Adaptive quality switching based on network conditions
 * - Fast startup with low latency mode
 * - Auto-retry on network drops
 * - Native Safari HLS support fallback
 * - Full playback controls with keyboard shortcuts
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2, WifiOff, RefreshCw
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Hls from "hls.js";

interface HLSPlayerProps {
  /** HLS playlist URL (.m3u8) or direct video URL */
  src: string;
  /** Fallback MP4 URL for non-HLS content */
  fallbackSrc?: string;
  /** Optional poster image */
  poster?: string;
  /** Error callback */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

interface QualityLevel {
  height: number;
  width: number;
  bitrate: number;
  name: string;
}

export function HLSPlayer({ 
  src, 
  fallbackSrc,
  poster,
  onError, 
  className = "" 
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
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
  
  // HLS specific state
  const [isBuffering, setIsBuffering] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [isHLS, setIsHLS] = useState(false);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // Double-tap seek
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right' | 'center'; visible: boolean }>({ side: 'left', visible: false });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Detect if source is HLS
  const isHLSSource = src.includes('.m3u8') || src.includes('application/vnd.apple.mpegurl');

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

  // Initialize HLS.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHLSSource && Hls.isSupported()) {
      setIsHLS(true);
      
      const hls = new Hls({
        // Performance tuning for smooth playback
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Fast startup
        startLevel: -1, // Auto
        capLevelToPlayerSize: true,
        // Retry configuration
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      // Quality levels
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = data.levels.map((level, index) => ({
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          name: level.height ? `${level.height}p` : `Level ${index + 1}`
        }));
        setQualityLevels(levels);
        console.log('HLS manifest parsed, quality levels:', levels.length);
      });

      // Track current quality
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentQuality(data.level);
      });

      // Buffering state
      hls.on(Hls.Events.FRAG_LOADING, () => setIsBuffering(true));
      hls.on(Hls.Events.FRAG_LOADED, () => setIsBuffering(false));
      hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false));

      // Error handling with auto-recovery
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('HLS error:', data.type, data.details);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setNetworkError(true);
              // Try to recover
              console.log('Attempting network recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Attempting media recovery...');
              hls.recoverMediaError();
              break;
            default:
              setMediaError('Unable to play this video. Please try again.');
              onError?.('HLS playback failed');
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    } else if (isHLSSource && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      setIsHLS(true);
      video.src = src;
    } else {
      // Regular video playback
      setIsHLS(false);
      video.src = fallbackSrc || src;
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      document.body.style.overflow = '';
    };
  }, [src, fallbackSrc, isHLSSource, onError]);

  // Quality switching
  const setQuality = useCallback((level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentQuality(level);
    }
    setShowQualityMenu(false);
  }, []);

  // Retry playback
  const retryPlayback = useCallback(() => {
    setNetworkError(false);
    setMediaError(null);
    
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
    
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(console.error);
    }
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
          setMediaError('Unable to play this file.');
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
    setMediaError('Unable to play this file.');
    onError?.('Media error');
  }, [onError]);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
    setNetworkError(false);
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

  // Error state with retry
  if (mediaError || networkError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-black rounded-xl">
        <div className="text-center space-y-4">
          {networkError ? (
            <WifiOff className="w-12 h-12 mx-auto text-muted-foreground" />
          ) : null}
          <p className="text-destructive">{mediaError || 'Network error'}</p>
          <button
            onClick={retryPlayback}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Quality badge
  const qualityBadge = currentQuality >= 0 && qualityLevels[currentQuality] 
    ? qualityLevels[currentQuality].name 
    : 'Auto';

  const renderControls = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-8"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      {/* Progress bar */}
      <div className="mb-4">
        <div className="relative">
          {/* Buffered indicator */}
          <div 
            className="absolute h-1 bg-white/30 rounded-full top-1/2 -translate-y-1/2 left-0"
            style={{ width: `${(buffered / duration) * 100}%` }}
          />
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer touch-manipulation relative z-10"
          />
        </div>
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
          {/* HLS Quality selector */}
          {isHLS && qualityLevels.length > 1 && (
            <div className="relative">
              <button 
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="text-white text-sm px-2 py-1 bg-white/10 rounded"
              >
                {qualityBadge}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg overflow-hidden min-w-[100px]">
                  <button
                    onClick={() => setQuality(-1)}
                    className={`block w-full px-4 py-2 text-sm text-left hover:bg-white/10 ${
                      currentQuality === -1 ? 'text-primary' : 'text-white'
                    }`}
                  >
                    Auto
                  </button>
                  {qualityLevels.map((level, index) => (
                    <button
                      key={index}
                      onClick={() => setQuality(index)}
                      className={`block w-full px-4 py-2 text-sm text-left hover:bg-white/10 ${
                        currentQuality === index ? 'text-primary' : 'text-white'
                      }`}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
          {!isMobile && (
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white p-2">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          )}

          {/* Mobile volume toggle */}
          {isMobile && (
            <button onClick={toggleMute} className="text-white p-2">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white p-2">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Fullscreen mode
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

        {/* Buffering indicator */}
        <AnimatePresence>
          {isBuffering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
            >
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video container */}
        <div 
          className="w-full h-full flex items-center justify-center touch-manipulation"
          onClick={handleVideoTap}
          onTouchEnd={handleVideoTap}
        >
          <video
            ref={videoRef}
            poster={poster}
            className={`max-w-full max-h-full object-contain ${
              isPortraitVideo ? 'h-full w-auto' : 'w-full h-auto'
            }`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleMediaEnded}
            onError={handleMediaError}
            onWaiting={handleWaiting}
            onCanPlay={handleCanPlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
            preload="metadata"
            controlsList="nodownload"
          />
        </div>

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
          {showControls && renderControls()}
        </AnimatePresence>
      </div>
    );
  }

  // Inline mode
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-black overflow-hidden rounded-xl ${className}`}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Buffering indicator */}
      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video */}
      <div 
        className="w-full h-full flex items-center justify-center touch-manipulation"
        onClick={handleVideoTap}
        onTouchEnd={handleVideoTap}
      >
        <video
          ref={videoRef}
          poster={poster}
          className="max-w-full max-h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleMediaEnded}
          onError={handleMediaError}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
          preload="metadata"
          controlsList="nodownload"
        />
      </div>

      {/* Large play button when paused */}
      <AnimatePresence>
        {!isPlaying && showControls && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={togglePlay}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center"
          >
            <Play className="w-8 h-8 text-white ml-1" />
          </motion.button>
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

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && renderControls()}
      </AnimatePresence>
    </div>
  );
}

export default HLSPlayer;

/**
 * HLSPlayer - Premium Adaptive Streaming Video Player
 * 
 * Features:
 * - HLS adaptive bitrate streaming with quality selection
 * - Production-grade glass-style controls (Apple HIG compliant)
 * - Mobile-first gesture controls (double-tap seek, swipe volume)
 * - Keyboard shortcuts for desktop
 * - Network error recovery with auto-retry
 * - Native Safari HLS fallback
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2, WifiOff, RefreshCw,
  Settings
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
  const [isBuffering, setIsBuffering] = useState(true); // Start true until canplay
  const [isStalled, setIsStalled] = useState(false); // Track stalled state separately
  const [showBufferSpinner, setShowBufferSpinner] = useState(false); // Delayed spinner display
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [isHLS, setIsHLS] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(0); // Buffer ahead in seconds
  const bufferSpinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Initialize HLS.js with real buffering detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state on source change
    setIsBuffering(true);
    setIsStalled(false);
    setNetworkError(false);
    setMediaError(null);

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Real buffering detection via native video events
    // These events are the most reliable for detecting actual playback issues
    // HARDENING: Use 150ms delay before showing spinner to avoid flicker on micro-buffers
    const handleWaiting = () => {
      console.log('🎬 Video waiting (buffering)');
      setIsBuffering(true);
    };
    
    const handleStalled = () => {
      console.log('🎬 Video stalled');
      setIsStalled(true);
      setIsBuffering(true);
    };
    
    const handlePlaying = () => {
      console.log('🎬 Video playing');
      setIsBuffering(false);
      setIsStalled(false);
      setNetworkError(false);
    };
    
    const handleCanPlay = () => {
      console.log('🎬 Video can play');
      setIsBuffering(false);
    };
    
    const handleCanPlayThrough = () => {
      console.log('🎬 Video can play through');
      setIsBuffering(false);
      setIsStalled(false);
    };

    const handleProgress = () => {
      // Calculate buffer health (how many seconds buffered ahead)
      if (video.buffered.length > 0) {
        const currentTime = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= currentTime && currentTime <= video.buffered.end(i)) {
            const bufferAhead = video.buffered.end(i) - currentTime;
            setBufferHealth(bufferAhead);
            break;
          }
        }
      }
    };

    // Attach native video event listeners
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('progress', handleProgress);

    if (isHLSSource && Hls.isSupported()) {
      setIsHLS(true);
      
      const hls = new Hls({
        // Performance tuning for smooth playback
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Fast startup
        startLevel: -1, // Auto
        capLevelToPlayerSize: true,
        // Retry configuration for reliability
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

      // Error handling with auto-recovery and fallback
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('HLS error:', data.type, data.details);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // If we have a fallback URL, use it immediately on network errors
              if (fallbackSrc) {
                console.log('HLS network error - switching to fallback URL');
                hls.destroy();
                hlsRef.current = null;
                setIsHLS(false);
                if (video) {
                  video.src = fallbackSrc;
                  video.load();
                }
                return;
              }
              setNetworkError(true);
              console.log('Attempting network recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Attempting media recovery...');
              hls.recoverMediaError();
              break;
            default:
              // Use fallback on any fatal error
              if (fallbackSrc) {
                console.log('HLS fatal error - switching to fallback URL');
                hls.destroy();
                hlsRef.current = null;
                setIsHLS(false);
                if (video) {
                  video.src = fallbackSrc;
                  video.load();
                }
                return;
              }
              setMediaError('Unable to play this video. Please try again.');
              onError?.('HLS playback failed');
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('stalled', handleStalled);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('canplaythrough', handleCanPlayThrough);
        video.removeEventListener('progress', handleProgress);
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
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('progress', handleProgress);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (bufferSpinnerTimeoutRef.current) {
        clearTimeout(bufferSpinnerTimeoutRef.current);
      }
      document.body.style.overflow = '';
    };
  }, [src, fallbackSrc, isHLSSource, onError]);

  // HARDENING: Delay buffer spinner by 150ms to avoid flicker on micro-buffers
  useEffect(() => {
    if (isBuffering || isStalled) {
      bufferSpinnerTimeoutRef.current = setTimeout(() => {
        setShowBufferSpinner(true);
      }, 150);
    } else {
      if (bufferSpinnerTimeoutRef.current) {
        clearTimeout(bufferSpinnerTimeoutRef.current);
      }
      setShowBufferSpinner(false);
    }
    
    return () => {
      if (bufferSpinnerTimeoutRef.current) {
        clearTimeout(bufferSpinnerTimeoutRef.current);
      }
    };
  }, [isBuffering, isStalled]);

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

  // Glass control bar component
  const renderGlassControls = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="absolute bottom-0 left-0 right-0 p-3 sm:p-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {/* Glass container */}
      <div 
        className="rounded-2xl p-3 sm:p-4"
        style={{
          background: 'rgba(15, 15, 15, 0.65)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Progress bar - YouTube style with buffer visualization */}
        <div className="mb-3">
          <div className="relative h-1 group hover:h-1.5 transition-all duration-150">
            {/* Background track */}
            <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
              {/* Buffered segments visualization - YouTube style */}
              <div 
                className="absolute h-full bg-white/30 rounded-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${duration > 0 ? (buffered / duration) * 100 : 0}%`,
                }}
              />
              {/* Playback progress - gradient with glow */}
              <div 
                className="absolute h-full rounded-full transition-[width] duration-100"
                style={{ 
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, hsl(43 100% 50%) 0%, hsl(38 100% 55%) 100%)',
                  boxShadow: '0 0 8px hsla(43, 100%, 50%, 0.5)',
                }}
              />
            </div>
            {/* Interactive slider overlay */}
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="absolute inset-0 cursor-pointer touch-manipulation [&>span:first-child]:bg-transparent [&_[role=slider]]:w-3.5 [&_[role=slider]]:h-3.5 group-hover:[&_[role=slider]]:w-4 group-hover:[&_[role=slider]]:h-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_0_10px_rgba(0,0,0,0.4)] [&_[role=slider]]:opacity-0 group-hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-all [&_[role=slider]]:duration-150"
            />
            {/* Buffering pulse animation when actively buffering */}
            {isBuffering && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute h-full rounded-full"
                style={{ 
                  left: `${duration > 0 ? (buffered / duration) * 100 : 0}%`,
                  width: '20px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, transparent 100%)',
                }}
              />
            )}
          </div>
          {/* Time display with buffer info */}
          <div className="flex justify-between items-center text-[11px] text-white/50 mt-1.5 font-medium tracking-wide">
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-2">
              {/* Buffer percentage indicator */}
              {isBuffering && buffered > currentTime && (
                <span className="text-white/30 text-[10px]">
                  Buffering...
                </span>
              )}
              {!isBuffering && buffered > 0 && buffered < duration && (
                <span className="text-white/30 text-[10px]">
                  {Math.round((buffered / duration) * 100)}% buffered
                </span>
              )}
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={skipBackward} 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button 
              onClick={togglePlay} 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button 
              onClick={skipForward} 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* HLS Quality selector */}
            {isHLS && qualityLevels.length > 1 && (
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSpeedMenu(false);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition-all flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{qualityBadge}</span>
                </button>
                <AnimatePresence>
                  {showQualityMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-2 right-0 rounded-xl overflow-hidden min-w-[120px]"
                      style={{
                        background: 'rgba(15, 15, 15, 0.85)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      <button
                        onClick={() => setQuality(-1)}
                        className={`block w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors ${
                          currentQuality === -1 ? 'text-primary font-medium' : 'text-white/80'
                        }`}
                      >
                        Auto
                      </button>
                      {qualityLevels.map((level, index) => (
                        <button
                          key={index}
                          onClick={() => setQuality(index)}
                          className={`block w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors ${
                            currentQuality === index ? 'text-primary font-medium' : 'text-white/80'
                          }`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Speed */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition-all"
              >
                {playbackSpeed}x
              </button>
              <AnimatePresence>
                {showSpeedMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-2 right-0 rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(15, 15, 15, 0.85)',
                      backdropFilter: 'blur(24px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {playbackSpeeds.map(speed => (
                      <button
                        key={speed}
                        onClick={() => changePlaybackSpeed(speed)}
                        className={`block w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors ${
                          playbackSpeed === speed ? 'text-primary font-medium' : 'text-white/80'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Volume */}
            {!isMobile && (
              <div className="flex items-center gap-1.5 group">
                <button 
                  onClick={toggleMute} 
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>
                <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-200">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-20 [&>span:first-child]:bg-white/20 [&>span:first-child>span]:bg-white [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
                  />
                </div>
              </div>
            )}

            {/* Mobile volume toggle */}
            {isMobile && (
              <button 
                onClick={toggleMute} 
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>
            )}

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen} 
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              {isFullscreen ? <Minimize className="w-4.5 h-4.5" /> : <Maximize className="w-4.5 h-4.5" />}
            </button>
          </div>
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
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95"
          style={{ 
            paddingTop: 'env(safe-area-inset-top)',
            background: 'rgba(15, 15, 15, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Buffering indicator - delayed by 150ms to avoid flicker */}
        <AnimatePresence>
          {showBufferSpinner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
            >
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(15, 15, 15, 0.5)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
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
            disablePictureInPicture
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
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(15, 15, 15, 0.6)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                {seekIndicator.side === 'left' ? (
                  <SkipBack className="w-8 h-8 text-white" />
                ) : (
                  <SkipForward className="w-8 h-8 text-white" />
                )}
              </div>
              <p className="text-white text-xs text-center mt-2 font-medium">10s</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls overlay */}
        <AnimatePresence>
          {showControls && renderGlassControls()}
        </AnimatePresence>
      </div>
    );
  }

  // Inline mode
  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden rounded-xl ${className}`}
      style={{ aspectRatio: '16 / 9' }}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Buffering indicator - delayed by 150ms to avoid flicker */}
      <AnimatePresence>
        {showBufferSpinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
          >
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(15, 15, 15, 0.5)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <Loader2 className="w-7 h-7 text-white animate-spin" />
            </div>
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
          className="w-full h-full object-contain"
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
          disablePictureInPicture
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full flex items-center justify-center active:scale-95"
            style={{
              background: 'rgba(15, 15, 15, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
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
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(15, 15, 15, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {seekIndicator.side === 'left' ? (
                <SkipBack className="w-6 h-6 text-white" />
              ) : (
                <SkipForward className="w-6 h-6 text-white" />
              )}
            </div>
            <p className="text-white text-xs text-center mt-1 font-medium">10s</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && renderGlassControls()}
      </AnimatePresence>
    </div>
  );
}

export default HLSPlayer;

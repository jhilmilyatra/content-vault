import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { FileItem, getFileUrl, formatFileSize } from "@/lib/fileService";
import { supabase } from "@/integrations/supabase/client";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import { 
  Download, X, FileText, File, Loader2, ZoomIn, ZoomOut, RotateCw,
  Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward,
  ChevronLeft, ChevronRight, Image, Minimize, Share2, Info, Music,
  FileVideo, Sparkles
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FilePreviewModalProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allFiles?: FileItem[];
  onNavigate?: (file: FileItem) => void;
}

export function FilePreviewModal({ 
  file, 
  open, 
  onOpenChange,
  allFiles = [],
  onNavigate 
}: FilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Video/Audio player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);
  
  // Video aspect ratio detection
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9); // Default 16:9
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  
  // Gallery state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Double-tap seek state
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; visible: boolean }>({ side: 'left', visible: false });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Gesture controls state (volume on right, brightness on left)
  const [gestureActive, setGestureActive] = useState(false);
  const [gestureType, setGestureType] = useState<'volume' | 'brightness' | null>(null);
  const [brightness, setBrightness] = useState(1); // 0.2 to 1.5
  const [gestureIndicator, setGestureIndicator] = useState<{ type: 'volume' | 'brightness'; value: number; visible: boolean }>({ type: 'volume', value: 1, visible: false });
  const gestureStartRef = useRef<{ x: number; y: number; startVolume: number; startBrightness: number } | null>(null);

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Filter media files for gallery navigation
  const mediaFiles = allFiles.filter(f => 
    f.mime_type.startsWith('image/') || 
    f.mime_type.startsWith('video/')
  );

  // Find current index in media files
  useEffect(() => {
    if (file && mediaFiles.length > 0) {
      const index = mediaFiles.findIndex(f => f.id === file.id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [file, mediaFiles]);
  
  // Get current media ref (video or audio)
  const getMediaRef = () => {
    const fileType = file ? getFileType(file.mime_type) : "other";
    return fileType === 'audio' ? audioRef.current : videoRef.current;
  };

  // Handle controls auto-hide (3 seconds timeout)
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    // Always auto-hide after 3 seconds when playing or in fullscreen
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (open && file) {
      loadFileUrl();
      setMediaError(null);
      resetControlsTimeout();
    } else {
      // Clean up blob URL to prevent memory leaks
      if (fileUrl && fileUrl.startsWith("blob:")) {
        URL.revokeObjectURL(fileUrl);
      }
      setFileUrl(null);
      setZoom(1);
      setRotation(0);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      setShowSpeedMenu(false);
      setMediaError(null);
      setShowInfo(false);
      setIsFullscreen(false);
      // Restore body scroll when modal closes
      document.body.style.overflow = '';
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      // Ensure body scroll is restored on unmount
      document.body.style.overflow = '';
    };
  }, [open, file]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !file) return;
    
    const fileType = getFileType(file.mime_type);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const isMediaFile = fileType === 'image' || fileType === 'video' || fileType === 'audio';
      
      // Gallery navigation for images/videos
      if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && isMediaFile) {
        e.preventDefault();
        if (mediaFiles.length > 1 && currentIndex > 0) {
          navigateGallery(-1);
        } else if (fileType === 'video' || fileType === 'audio') {
          skipBackward();
        }
      }
      if (e.code === 'ArrowRight' && !e.ctrlKey && !e.metaKey && isMediaFile) {
        e.preventDefault();
        if (mediaFiles.length > 1 && currentIndex < mediaFiles.length - 1) {
          navigateGallery(1);
        } else if (fileType === 'video' || fileType === 'audio') {
          skipForward();
        }
      }
      
      // Media controls
      const media = getMediaRef();
      if (!media) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            const newVol = Math.min(volume + 0.1, 1);
            media.volume = newVol;
            setVolume(newVol);
            setIsMuted(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          {
            const newVol = Math.max(volume - 0.1, 0);
            media.volume = newVol;
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
          if (fileType === 'video') toggleFullscreen();
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
  }, [open, file, volume, isPlaying, duration, currentIndex, mediaFiles.length, isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const navigateGallery = (direction: number) => {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < mediaFiles.length) {
      lightHaptic();
      const newFile = mediaFiles[newIndex];
      if (onNavigate) {
        onNavigate(newFile);
      }
      setCurrentIndex(newIndex);
    }
  };

  // Touch swipe for gallery
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < mediaFiles.length - 1) {
        navigateGallery(1);
      } else if (diff < 0 && currentIndex > 0) {
        navigateGallery(-1);
      }
    }
    
    setTouchStart(null);
  };

  const loadFileUrl = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      supabase.functions.invoke('track-file-view', {
        body: {
          fileId: file.id,
          viewType: 'preview',
          bytesTransferred: file.size_bytes
        }
      }).catch((err) => console.error('Failed to track view:', err));

      const fileResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=get`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!fileResponse.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await fileResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      setFileUrl(blobUrl);
    } catch (error) {
      console.error("Error loading file:", error);
      toast({
        title: "Error",
        description: "Failed to load file preview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    
    setDownloading(true);
    mediumHaptic();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      supabase.functions.invoke('track-file-view', {
        body: {
          fileId: file.id,
          viewType: 'download',
          bytesTransferred: file.size_bytes
        }
      }).catch((err) => console.error('Failed to track download:', err));

      const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=get`;
      
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      
      if (!response.ok) throw new Error("Failed to fetch file");
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: "Download started",
        description: `Downloading ${file.original_name}`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Failed to download file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const getFileType = (mimeType: string): "image" | "video" | "audio" | "pdf" | "other" => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.wma'];
    if (file) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (videoExtensions.includes(ext)) return "video";
      if (audioExtensions.includes(ext)) return "audio";
    }
    return "other";
  };

  // Media player controls
  const togglePlay = () => {
    const media = getMediaRef();
    if (media) {
      lightHaptic();
      if (isPlaying) {
        media.pause();
      } else {
        media.play().catch(err => {
          console.error('Playback error:', err);
          setMediaError('Unable to play this file. The format may not be supported.');
        });
      }
      setIsPlaying(!isPlaying);
      resetControlsTimeout();
    }
  };

  const toggleMute = () => {
    const media = getMediaRef();
    if (media) {
      lightHaptic();
      media.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const media = getMediaRef();
    if (media) {
      const newVolume = value[0];
      media.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (value: number[]) => {
    const media = getMediaRef();
    if (media) {
      media.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleTimeUpdate = () => {
    const media = getMediaRef();
    if (media) {
      setCurrentTime(media.currentTime);
      // Update buffered
      if (media.buffered.length > 0) {
        setBuffered(media.buffered.end(media.buffered.length - 1));
      }
    }
  };

  const handleLoadedMetadata = () => {
    const media = getMediaRef();
    if (media) {
      setDuration(media.duration);
      
      // Detect video aspect ratio
      if (media instanceof HTMLVideoElement) {
        const { videoWidth, videoHeight } = media;
        if (videoWidth && videoHeight) {
          const ratio = videoWidth / videoHeight;
          setVideoAspectRatio(ratio);
          setIsPortraitVideo(ratio < 1); // Portrait if width < height
        }
      }
    }
  };

  const handleMediaEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleMediaError = () => {
    setMediaError('Unable to play this file. The format may not be supported by your browser.');
  };

  const skipForward = () => {
    const media = getMediaRef();
    if (media) {
      lightHaptic();
      media.currentTime = Math.min(media.currentTime + 10, duration);
    }
  };

  const skipBackward = () => {
    const media = getMediaRef();
    if (media) {
      lightHaptic();
      media.currentTime = Math.max(media.currentTime - 10, 0);
    }
  };

  const toggleFullscreen = () => {
    // Use our own fullscreen state instead of browser fullscreen API for better control
    // This ensures controls are always visible and positioned correctly
    setIsFullscreen(prev => !prev);
    
    // Lock/unlock body scroll
    if (!isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const media = getMediaRef();
    if (media) {
      lightHaptic();
      media.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle double-tap seek
  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const container = videoContainerRef.current;
    if (!container || !videoRef.current) return;

    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const isLeftSide = x < rect.width / 2;

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const wasLeftSide = lastTapRef.current.x < rect.width / 2;
      if (isLeftSide === wasLeftSide) {
        mediumHaptic();
        if (isLeftSide) {
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          setSeekIndicator({ side: 'left', visible: true });
        } else {
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
          setSeekIndicator({ side: 'right', visible: true });
        }
        setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 500);
        lastTapRef.current = null;
        return;
      }
    }

    lastTapRef.current = { time: now, x };
    resetControlsTimeout();
    
    setTimeout(() => {
      if (lastTapRef.current && now === lastTapRef.current.time) {
        togglePlay();
        lastTapRef.current = null;
      }
    }, 300);
  };

  // Gesture handlers for volume/brightness swipe control
  const handleGestureStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const container = videoContainerRef.current;
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
  };

  const handleGestureMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!gestureStartRef.current) return;
    
    const touch = e.touches[0];
    const container = videoContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const startX = gestureStartRef.current.x - rect.left;
    const deltaY = gestureStartRef.current.y - touch.clientY; // Positive = swipe up
    
    // Need at least 15px vertical movement to activate gesture
    if (Math.abs(deltaY) < 15 && !gestureActive) return;
    
    const isRightSide = startX > rect.width * 0.6;
    const isLeftSide = startX < rect.width * 0.4;
    
    if (!isRightSide && !isLeftSide) {
      gestureStartRef.current = null;
      return;
    }
    
    setGestureActive(true);
    
    // Calculate change based on vertical swipe (200px = full range)
    const sensitivity = 200;
    const change = deltaY / sensitivity;
    
    if (isRightSide) {
      // Volume control
      setGestureType('volume');
      const newVolume = Math.max(0, Math.min(1, gestureStartRef.current.startVolume + change));
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setIsMuted(newVolume === 0);
      }
      setGestureIndicator({ type: 'volume', value: newVolume, visible: true });
    } else {
      // Brightness control
      setGestureType('brightness');
      const newBrightness = Math.max(0.2, Math.min(1.5, gestureStartRef.current.startBrightness + change));
      setBrightness(newBrightness);
      setGestureIndicator({ type: 'brightness', value: newBrightness, visible: true });
    }
    
    e.preventDefault(); // Prevent scrolling while adjusting
  };

  const handleGestureEnd = () => {
    gestureStartRef.current = null;
    setGestureActive(false);
    setGestureType(null);
    // Hide indicator after a delay
    setTimeout(() => setGestureIndicator(prev => ({ ...prev, visible: false })), 800);
  };

  const renderPreview = () => {
    if (!file || !fileUrl) return null;

    const fileType = getFileType(file.mime_type);

    switch (fileType) {
      case "image":
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex-1 flex items-center justify-center overflow-hidden"
            onTouchStart={mediaFiles.length > 1 ? handleTouchStart : undefined}
            onTouchEnd={mediaFiles.length > 1 ? handleTouchEnd : undefined}
          >
            <motion.img
              key={file.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-[75vh] object-contain select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease-out',
              }}
              draggable={false}
            />
            
            {/* Gallery navigation arrows */}
            {mediaFiles.length > 1 && (
              <>
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: currentIndex > 0 ? 1 : 0.3, x: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigateGallery(-1)}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: currentIndex < mediaFiles.length - 1 ? 1 : 0.3, x: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigateGallery(1)}
                  disabled={currentIndex === mediaFiles.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-6 h-6" />
                </motion.button>
              </>
            )}
          </motion.div>
        );

      case "video":
        // Calculate aspect ratio for the video
        // For cinematic/ultra-wide videos (2.35:1, 21:9, etc.), ensure they fill width
        // YouTube/Netflix-style: Portrait videos get max-height constraint, landscape get aspect-video
        // This prevents layout jumps and half-screen bugs on mobile
        
        return (
          // CRITICAL: Use block-level container with relative positioning for fullscreen controls
          <motion.div 
            ref={videoContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`relative w-full bg-black overflow-hidden ${
              isFullscreen 
                ? 'fixed inset-0 z-[9999] rounded-none flex items-center justify-center' 
                : isPortraitVideo 
                  ? 'aspect-[9/16] max-h-[70vh] mx-auto' // Portrait: constrained height like YouTube
                  : 'aspect-video' // Landscape: standard 16:9 container
            } rounded-xl sm:rounded-2xl`}
            onMouseMove={resetControlsTimeout}
            onClick={resetControlsTimeout}
            onTouchStart={(e) => {
              resetControlsTimeout();
              handleGestureStart(e);
            }}
            onTouchMove={handleGestureMove}
            onTouchEnd={handleGestureEnd}
          >
            {/* Brightness overlay - covers the video */}
            <div 
              className="absolute inset-0 bg-black pointer-events-none z-[1] transition-opacity duration-150"
              style={{ opacity: 1 - brightness }}
            />
            
            {/* Gesture indicator - Volume/Brightness */}
            <AnimatePresence>
              {gestureIndicator.visible && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`absolute top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none ${
                    gestureIndicator.type === 'volume' ? 'right-8' : 'left-8'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center">
                    {gestureIndicator.type === 'volume' ? (
                      gestureIndicator.value === 0 ? (
                        <VolumeX className="w-7 h-7 text-white" />
                      ) : (
                        <Volume2 className="w-7 h-7 text-white" />
                      )
                    ) : (
                      <Sparkles className="w-7 h-7 text-white" />
                    )}
                  </div>
                  {/* Vertical progress bar */}
                  <div className="w-1.5 h-24 bg-white/20 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="absolute bottom-0 left-0 right-0 bg-white rounded-full"
                      initial={false}
                      animate={{ 
                        height: `${gestureIndicator.type === 'volume' 
                          ? gestureIndicator.value * 100 
                          : ((gestureIndicator.value - 0.2) / 1.3) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="text-white text-xs font-semibold">
                    {gestureIndicator.type === 'volume' 
                      ? `${Math.round(gestureIndicator.value * 100)}%`
                      : `${Math.round(gestureIndicator.value * 100)}%`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Video Element - object-contain for proper scaling */}
            <div 
              className={`relative cursor-pointer z-[2] ${
                isFullscreen 
                  ? 'w-full h-full flex items-center justify-center' 
                  : 'w-full h-full'
              }`}
              onClick={!gestureActive ? handleVideoTap : undefined}
              onTouchEnd={!gestureActive ? handleVideoTap : undefined}
            >
              <video
                ref={videoRef}
                src={fileUrl}
                className="w-full h-full object-contain"
                style={{ filter: `brightness(${brightness})` }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleMediaEnded}
                onError={handleMediaError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
                crossOrigin="anonymous"
                preload="metadata"
                controlsList="nodownload"
              />
              
              {/* Double-tap seek indicators - YouTube style */}
              <AnimatePresence>
                {seekIndicator.visible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
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
              
              {/* Center play button - Netflix style */}
              <AnimatePresence>
                {!isPlaying && !seekIndicator.visible && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none"
                  >
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl"
                    >
                      <Play className="w-8 h-8 sm:w-10 sm:h-10 text-black ml-1" />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Glass Controls Overlay - YouTube/Netflix style - ALWAYS in fullscreen container */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ 
                  opacity: showControls ? 1 : 0, 
                  y: showControls ? 0 : 10,
                  pointerEvents: showControls ? 'auto' : 'none'
                }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className={`absolute inset-x-0 bottom-0 ${isFullscreen ? 'z-[10000]' : ''}`}
              >
                {/* Glass background */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent ${isFullscreen ? '' : 'backdrop-blur-sm'}`} />
                
                <div className="relative p-3 sm:p-4">
                  {/* Progress bar with buffer indicator */}
                  <div className="mb-3 relative">
                    <div className="absolute inset-0 h-1.5 rounded-full bg-white/10" />
                    <div 
                      className="absolute h-1.5 rounded-full bg-white/20"
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
                    {/* Mobile time display */}
                    <div className="flex justify-between text-xs text-white/80 mt-2 sm:hidden font-medium tabular-nums">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Control buttons - Glass style */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={skipBackward}
                        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all touch-manipulation"
                      >
                        <SkipBack className="w-5 h-5" />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={togglePlay}
                        className="w-12 h-12 sm:w-11 sm:h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg touch-manipulation"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-black" />
                        ) : (
                          <Play className="w-6 h-6 text-black ml-0.5" />
                        )}
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={skipForward}
                        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all touch-manipulation"
                      >
                        <SkipForward className="w-5 h-5" />
                      </motion.button>

                      {/* Desktop time display */}
                      <span className="hidden sm:inline text-white/80 text-sm ml-3 font-medium tabular-nums">
                        {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Playback speed - glass button */}
                      <div className="relative">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                          className="h-10 px-3 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
                        >
                          {playbackSpeed}x
                        </motion.button>
                        <AnimatePresence>
                          {showSpeedMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden min-w-[90px] shadow-xl"
                            >
                              {playbackSpeeds.map((speed) => (
                                <button
                                  key={speed}
                                  onClick={() => changePlaybackSpeed(speed)}
                                  className={`w-full px-4 py-3 text-sm text-left hover:bg-white/20 transition-colors touch-manipulation ${
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

                      {/* Volume control - hidden on mobile */}
                      <div className="hidden sm:flex items-center gap-2 group">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={toggleMute}
                          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </motion.button>
                        <div className="w-20 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleMute}
                        className="sm:hidden w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all touch-manipulation"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={toggleFullscreen}
                        className="w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all touch-manipulation"
                      >
                        {isFullscreen ? (
                          <Minimize className="w-5 h-5" />
                        ) : (
                          <Maximize className="w-5 h-5" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Fullscreen close button - top right corner - shows/hides with controls */}
            {isFullscreen && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: showControls ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
                className="absolute top-4 right-4 z-[10001] w-12 h-12 sm:w-11 sm:h-11 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/90 transition-all touch-manipulation active:scale-90 shadow-lg"
              >
                <X className="w-6 h-6 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </motion.div>
        );

      case "audio":
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8"
          >
            {/* Audio visualization */}
            <motion.div 
              animate={isPlaying ? { 
                boxShadow: ['0 0 60px rgba(212,175,55,0.3)', '0 0 80px rgba(212,175,55,0.5)', '0 0 60px rgba(212,175,55,0.3)']
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative w-40 h-40 rounded-full bg-gradient-to-br from-gold/20 via-gold/10 to-transparent border border-gold/20 flex items-center justify-center"
            >
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/[0.03] to-transparent" />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-2xl shadow-gold/30"
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10 text-black" />
                ) : (
                  <Play className="w-10 h-10 text-black ml-1" />
                )}
              </motion.button>
              
              {/* Animated rings */}
              {isPlaying && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-gold/30"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    className="absolute inset-0 rounded-full border border-gold/20"
                  />
                </>
              )}
            </motion.div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Music className="w-5 h-5 text-gold" />
                <p className="text-xl font-semibold text-white font-outfit">{file.name}</p>
              </div>
              <p className="text-white/40 text-sm">{formatFileSize(file.size_bytes)}</p>
            </div>
            
            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={fileUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleMediaEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={handleMediaError}
              className="hidden"
            />
            
            {mediaError && (
              <div className="text-red-400 text-sm text-center px-4 bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                {mediaError}
              </div>
            )}
            
            {/* Audio controls */}
            <div className="w-full max-w-md space-y-4">
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer touch-manipulation"
                />
                <div className="flex justify-between text-xs text-white/40 font-medium tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={skipBackward}
                  className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                >
                  <SkipBack className="w-5 h-5" />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 text-black" />
                  ) : (
                    <Play className="w-6 h-6 text-black ml-0.5" />
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={skipForward}
                  className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                >
                  <SkipForward className="w-5 h-5" />
                </motion.button>
              </div>
              
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-xs font-medium rounded-lg border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/10"
                  >
                    {playbackSpeed}x
                  </Button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full mb-2 left-0 bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden min-w-[80px] z-10 shadow-xl"
                      >
                        {playbackSpeeds.map((speed) => (
                          <button
                            key={speed}
                            onClick={() => changePlaybackSpeed(speed)}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors ${
                              playbackSpeed === speed ? 'text-gold bg-gold/10' : 'text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMute}
                    className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </motion.button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );

      case "pdf":
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 w-full h-[75vh] rounded-2xl overflow-hidden border border-white/10"
          >
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0 bg-white"
              title={file.name}
            />
          </motion.div>
        );

      default:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
          >
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 flex items-center justify-center">
              <File className="w-14 h-14 text-white/30" />
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-white font-outfit">{file.name}</p>
              <p className="text-white/40 mt-1">{formatFileSize(file.size_bytes)}</p>
              <p className="text-sm text-white/30 mt-3">
                Preview not available for this file type
              </p>
            </div>
            <Button 
              onClick={handleDownload} 
              disabled={downloading}
              className="mt-4 rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold px-6"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download to View
            </Button>
          </motion.div>
        );
    }
  };

  const fileType = file ? getFileType(file.mime_type) : "other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={modalContainerRef}
        className="max-w-6xl w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden bg-black/95 backdrop-blur-2xl border-white/10 rounded-3xl"
      >
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.06] bg-white/[0.02]"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
              {fileType === 'image' ? <Image className="w-5 h-5 text-gold" /> :
               fileType === 'video' ? <FileVideo className="w-5 h-5 text-gold" /> :
               fileType === 'audio' ? <Music className="w-5 h-5 text-gold" /> :
               <File className="w-5 h-5 text-gold" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate font-outfit">
                {file?.name || "File Preview"}
              </h3>
              <p className="text-xs text-white/40">{file?.mime_type} • {file ? formatFileSize(file.size_bytes) : ''}</p>
            </div>
          </div>
          
          {/* Gallery counter */}
          {mediaFiles.length > 1 && (fileType === 'image' || fileType === 'video') && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] mr-4">
              <Image className="w-4 h-4 text-white/40" />
              <span className="text-sm text-white/60 font-medium">
                {currentIndex + 1} / {mediaFiles.length}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {fileType === "image" && (
              <>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    lightHaptic();
                    setZoom((z) => Math.max(0.5, z - 0.25));
                  }}
                  disabled={zoom <= 0.5}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ZoomOut className="w-4 h-4" />
                </motion.button>
                <span className="text-sm text-white/50 min-w-[3rem] text-center font-medium tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    lightHaptic();
                    setZoom((z) => Math.min(3, z + 0.25));
                  }}
                  disabled={zoom >= 3}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <ZoomIn className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    lightHaptic();
                    setRotation((r) => (r + 90) % 360);
                  }}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                </motion.button>
                <div className="w-px h-6 bg-white/10 mx-1" />
              </>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                lightHaptic();
                setShowInfo(!showInfo);
              }}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                showInfo 
                  ? 'bg-gold/20 border-gold/30 text-gold' 
                  : 'bg-white/[0.05] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Info className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDownload}
              disabled={!fileUrl || downloading}
              className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center h-[65vh] gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="relative"
                >
                  <div className="w-16 h-16 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-gold border-t-transparent animate-spin" />
                </motion.div>
                <p className="text-white/40 text-sm">Loading preview...</p>
              </motion.div>
            ) : (
              <motion.div key="content" className="h-full">
                {renderPreview()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* File Info Panel */}
        <AnimatePresence>
          {showInfo && file && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-white/40 mb-1">File Name</p>
                  <p className="text-sm text-white font-medium truncate">{file.original_name}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Size</p>
                  <p className="text-sm text-white font-medium">{formatFileSize(file.size_bytes)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Type</p>
                  <p className="text-sm text-white font-medium">{file.mime_type}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">Created</p>
                  <p className="text-sm text-white font-medium">
                    {new Date(file.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gallery Thumbnails */}
        {mediaFiles.length > 1 && (fileType === 'image' || fileType === 'video') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-white/[0.06] bg-white/[0.02] p-3 overflow-x-auto"
          >
            <div className="flex items-center gap-2 justify-center min-w-max">
              {mediaFiles.slice(Math.max(0, currentIndex - 5), Math.min(mediaFiles.length, currentIndex + 6)).map((mediaFile, idx) => {
                const actualIndex = Math.max(0, currentIndex - 5) + idx;
                const isActive = actualIndex === currentIndex;
                return (
                  <motion.button
                    key={mediaFile.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (onNavigate) {
                        lightHaptic();
                        onNavigate(mediaFile);
                        setCurrentIndex(actualIndex);
                      }
                    }}
                    className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                      isActive 
                        ? 'ring-2 ring-gold ring-offset-2 ring-offset-black' 
                        : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className={`absolute inset-0 flex items-center justify-center ${
                      mediaFile.mime_type.startsWith('video/') 
                        ? 'bg-gradient-to-br from-violet-500/30 to-purple-500/30' 
                        : 'bg-gradient-to-br from-pink-500/30 to-rose-500/30'
                    }`}>
                      {mediaFile.mime_type.startsWith('video/') ? (
                        <FileVideo className="w-6 h-6 text-white/70" />
                      ) : (
                        <Image className="w-6 h-6 text-white/70" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}

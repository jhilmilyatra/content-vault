import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/fileService";
import { 
  Download, X, FileText, File, Loader2, ZoomIn, ZoomOut, RotateCw,
  Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface GuestFileItem {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}

interface GuestFilePreviewModalProps {
  file: GuestFileItem | null;
  guestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuestFilePreviewModal({ file, guestId, open, onOpenChange }: GuestFilePreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Video/Audio player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // Video aspect ratio detection
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9); // Default 16:9
  const [isPortraitVideo, setIsPortraitVideo] = useState(false);
  
  // Double-tap seek state
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; visible: boolean }>({ side: 'left', visible: false });

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  
  // Get current media ref (video or audio)
  const getMediaRef = () => {
    const fileType = file ? getFileType(file.mime_type) : "other";
    return fileType === 'audio' ? audioRef.current : videoRef.current;
  };

  useEffect(() => {
    if (open && file) {
      loadFileUrl();
      setMediaError(null);
    } else {
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
    }
  }, [open, file]);

  // Keyboard shortcuts for video/audio player
  useEffect(() => {
    if (!open || !file) return;
    
    const fileType = getFileType(file.mime_type);
    if (fileType !== 'video' && fileType !== 'audio') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const media = getMediaRef();
      if (!media) return;
      
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, file, volume, isPlaying, duration]);

  const loadFileUrl = async () => {
    if (!file || !guestId) return;
    setLoading(true);
    try {
      // Use guest file streaming edge function
      const response = await supabase.functions.invoke('guest-file-stream', {
        body: {
          guestId,
          storagePath: file.storage_path,
          action: 'get-url',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to get file URL');
      }

      // Handle large file case
      if (response.data?.suggestDownload) {
        toast({
          title: "File too large for preview",
          description: `This file is ${formatFileSize(response.data.size)}. Please download it to view.`,
          variant: "default",
        });
        setFileUrl(null);
        setLoading(false);
        return;
      }

      if (response.data?.url) {
        setFileUrl(response.data.url);
      } else if (response.data?.blob) {
        // If we get blob data directly
        const blob = new Blob([response.data.blob], { type: file.mime_type });
        const blobUrl = URL.createObjectURL(blob);
        setFileUrl(blobUrl);
      }
    } catch (error) {
      console.error("Error loading file:", error);
      toast({
        title: "Error",
        description: "Failed to load file preview. Try downloading the file instead.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file || !guestId) return;
    
    setDownloading(true);
    try {
      const response = await supabase.functions.invoke('guest-file-stream', {
        body: {
          guestId,
          storagePath: file.storage_path,
          action: 'download',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to download file');
      }

      // Create download link
      if (response.data?.url) {
        const a = document.createElement("a");
        a.href = response.data.url;
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
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
    // Handle common video formats that might have wrong mime types
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.wma'];
    if (file) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (videoExtensions.includes(ext)) return "video";
      if (audioExtensions.includes(ext)) return "audio";
    }
    return "other";
  };

  // Media player controls - work for both video and audio
  const togglePlay = () => {
    const media = getMediaRef();
    if (media) {
      if (isPlaying) {
        media.pause();
      } else {
        media.play().catch(err => {
          console.error('Playback error:', err);
          setMediaError('Unable to play this file. The format may not be supported.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const media = getMediaRef();
    if (media) {
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
  };

  const handleMediaError = () => {
    setMediaError('Unable to play this file. The format may not be supported by your browser.');
  };

  const skipForward = () => {
    const media = getMediaRef();
    if (media) {
      media.currentTime = Math.min(media.currentTime + 10, duration);
    }
  };

  const skipBackward = () => {
    const media = getMediaRef();
    if (media) {
      media.currentTime = Math.max(media.currentTime - 10, 0);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const media = getMediaRef();
    if (media) {
      media.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
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

    // Check for double-tap (within 300ms and same side)
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const wasLeftSide = lastTapRef.current.x < rect.width / 2;
      if (isLeftSide === wasLeftSide) {
        // Double-tap detected
        if (isLeftSide) {
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          setSeekIndicator({ side: 'left', visible: true });
        } else {
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
          setSeekIndicator({ side: 'right', visible: true });
        }
        // Hide indicator after animation
        setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 500);
        lastTapRef.current = null;
        return;
      }
    }

    lastTapRef.current = { time: now, x };
    
    // Single tap toggles play/pause after a delay (if not double-tap)
    setTimeout(() => {
      if (lastTapRef.current && now === lastTapRef.current.time) {
        togglePlay();
        lastTapRef.current = null;
      }
    }, 300);
  };

  const renderPreview = () => {
    if (!file || !fileUrl) return null;

    const fileType = getFileType(file.mime_type);

    switch (fileType) {
      case "image":
        return (
          <div className="flex-1 flex items-center justify-center overflow-hidden bg-black/20 rounded-lg">
            <img
              src={fileUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        );

      case "video":
        // Calculate aspect ratio padding (height/width * 100)
        // For portrait videos on mobile, cap the height to avoid too tall containers
        const aspectPadding = isPortraitVideo 
          ? Math.min((1 / videoAspectRatio) * 100, 133) // Cap at 4:3 portrait max (133%)
          : (1 / videoAspectRatio) * 100;
        
        return (
          <div 
            className="flex-1 flex flex-col bg-black rounded-xl sm:rounded-2xl overflow-hidden"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(isPlaying ? false : true)}
            onTouchStart={() => {
              setShowControls(true);
              // Auto-hide after 3s on mobile
              if (isPlaying) {
                setTimeout(() => setShowControls(false), 3000);
              }
            }}
          >
            {/* Video Container - Auto aspect ratio detection */}
            <div 
              ref={videoContainerRef}
              className={`relative w-full bg-black flex-shrink-0 transition-all duration-300 ${
                isPortraitVideo ? 'mx-auto max-w-[70%] sm:max-w-[50%]' : ''
              }`}
              style={{ paddingTop: `${aspectPadding}%` }}
              onClick={handleVideoTap}
              onTouchEnd={handleVideoTap}
            >
              <video
                ref={videoRef}
                src={fileUrl}
                className="absolute inset-0 w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleMediaEnded}
                onError={handleMediaError}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                crossOrigin="anonymous"
                preload="metadata"
                controlsList="nodownload"
              />
              
              {/* Double-tap seek indicators - YouTube style */}
              {seekIndicator.visible && (
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 animate-fade-in pointer-events-none ${
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
                </div>
              )}
              
              {/* Center play button - Netflix style */}
              {!isPlaying && !seekIndicator.visible && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-200 pointer-events-none">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 text-black ml-1" />
                  </div>
                </div>
              )}

              {/* Glass Controls Overlay - YouTube/Netflix style */}
              <div 
                className={`absolute inset-x-0 bottom-0 transition-all duration-200 ease-out ${
                  showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
              >
                {/* Glass background */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent backdrop-blur-sm" />
                
                <div className="relative p-3 sm:p-4">
                  {/* Progress bar with larger touch target */}
                  <div className="mb-3">
                    <Slider
                      value={[currentTime]}
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="cursor-pointer touch-manipulation [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 sm:[&_[role=slider]]:h-4 sm:[&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_[role=slider]]:bg-white"
                    />
                    {/* Mobile time display */}
                    <div className="flex justify-between text-xs text-white/80 mt-2 sm:hidden font-medium tabular-nums">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Control buttons - Glass style */}
                  <div className="flex items-center justify-between">
                    {/* Left controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={skipBackward}
                        className="text-white hover:bg-white/20 h-11 w-11 sm:h-10 sm:w-10 rounded-full touch-manipulation active:scale-90 transition-transform"
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePlay}
                        className="text-white bg-white/10 hover:bg-white/20 h-12 w-12 sm:h-11 sm:w-11 rounded-full touch-manipulation active:scale-90 transition-transform"
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-0.5" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={skipForward}
                        className="text-white hover:bg-white/20 h-11 w-11 sm:h-10 sm:w-10 rounded-full touch-manipulation active:scale-90 transition-transform"
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>

                      {/* Desktop time display */}
                      <span className="hidden sm:inline text-white/80 text-sm ml-3 font-medium tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Playback speed - glass button */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                          className="text-white hover:bg-white/20 h-10 px-3 rounded-lg text-sm font-medium touch-manipulation"
                        >
                          {playbackSpeed}x
                        </Button>
                        {showSpeedMenu && (
                          <div className="absolute bottom-full mb-2 right-0 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden min-w-[80px] z-50 shadow-xl">
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
                          </div>
                        )}
                      </div>

                      {/* Volume - hidden on mobile */}
                      <div className="hidden sm:flex items-center gap-2 group">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleMute}
                          className="text-white hover:bg-white/20 h-10 w-10 rounded-full"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        className="sm:hidden text-white hover:bg-white/20 h-11 w-11 rounded-full touch-manipulation active:scale-90 transition-transform"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="text-white hover:bg-white/20 h-11 w-11 sm:h-10 sm:w-10 rounded-full touch-manipulation active:scale-90 transition-transform"
                      >
                        <Maximize className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "audio":
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
            {/* Audio visualization circle */}
            <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center transition-transform ${isPlaying ? 'animate-pulse' : ''}`}>
              <button
                onClick={togglePlay}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-all active:scale-95 touch-manipulation"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
                ) : (
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground ml-1" />
                )}
              </button>
            </div>
            
            <p className="text-lg font-medium text-foreground text-center">{file.name}</p>
            
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
            
            {/* Error message */}
            {mediaError && (
              <div className="text-destructive text-sm text-center px-4">
                {mediaError}
              </div>
            )}
            
            {/* Audio controls */}
            <div className="w-full max-w-md space-y-3">
              {/* Progress bar */}
              <div className="space-y-1">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer touch-manipulation"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              
              {/* Control buttons */}
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBackward}
                  className="h-10 w-10 touch-manipulation active:scale-95"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="h-12 w-12 touch-manipulation active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipForward}
                  className="h-10 w-10 touch-manipulation active:scale-95"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>
              
              {/* Speed and volume controls */}
              <div className="flex items-center justify-between gap-4">
                {/* Speed control */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-xs font-medium"
                  >
                    {playbackSpeed}x
                  </Button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 left-0 bg-popover rounded-lg border shadow-lg overflow-hidden min-w-[80px] z-10">
                      {playbackSpeeds.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changePlaybackSpeed(speed)}
                          className={`w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${
                            playbackSpeed === speed ? 'text-primary bg-muted' : ''
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Volume control */}
                <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="h-8 w-8 flex-shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
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
          </div>
        );

      case "pdf":
        return (
          <div className="flex-1 w-full h-[70vh] bg-muted rounded-lg overflow-hidden">
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              title={file.name}
            />
          </div>
        );

      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center">
              <File className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Preview not available for this file type
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size_bytes)}
              </p>
            </div>
            <Button onClick={handleDownload} className="mt-4" disabled={downloading}>
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download to View
            </Button>
          </div>
        );
    }
  };

  const fileType = file ? getFileType(file.mime_type) : "other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {file?.name || "File Preview"}
            </h3>
            <p className="text-xs text-muted-foreground">{file?.mime_type}</p>
          </div>
          <div className="flex items-center gap-2">
            {fileType === "image" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDownload} 
              disabled={!fileUrl || downloading}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto bg-background/50">
          {loading ? (
            <div className="flex-1 flex items-center justify-center h-[60vh]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            renderPreview()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

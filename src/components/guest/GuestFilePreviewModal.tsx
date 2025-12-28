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

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // Double-tap seek state
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; visible: boolean }>({ side: 'left', visible: false });

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  useEffect(() => {
    if (open && file) {
      loadFileUrl();
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
    }
  }, [open, file]);

  // Keyboard shortcuts for video player
  useEffect(() => {
    if (!open || !file) return;
    
    const fileType = getFileType(file.mime_type);
    if (fileType !== 'video') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
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
          if (videoRef.current) {
            const newVol = Math.min(volume + 0.1, 1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setIsMuted(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.max(volume - 0.1, 0);
            videoRef.current.volume = newVol;
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
    return "other";
  };

  // Video player controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      const newVolume = value[0];
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
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
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
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
        return (
          <div 
            className="flex-1 flex flex-col bg-black rounded-lg overflow-hidden"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(isPlaying ? false : true)}
            onTouchStart={() => setShowControls(true)}
          >
            {/* Video Element */}
            <div 
              ref={videoContainerRef}
              className="relative flex-1 flex items-center justify-center"
              onClick={handleVideoTap}
              onTouchEnd={handleVideoTap}
            >
              <video
                ref={videoRef}
                src={fileUrl}
                className="max-w-full max-h-[60vh] sm:max-h-[60vh] object-contain pointer-events-none"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleVideoEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
                webkit-playsinline="true"
                crossOrigin="anonymous"
              />
              
              {/* Double-tap seek indicators */}
              {seekIndicator.visible && (
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 animate-fade-in ${
                    seekIndicator.side === 'left' ? 'left-8' : 'right-8'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {seekIndicator.side === 'left' ? (
                      <SkipBack className="w-7 h-7 text-white" />
                    ) : (
                      <SkipForward className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <span className="text-white text-sm font-medium">
                    {seekIndicator.side === 'left' ? '-10s' : '+10s'}
                  </span>
                </div>
              )}
              
              {/* Play overlay button */}
              {!isPlaying && !seekIndicator.visible && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40 touch-manipulation pointer-events-none"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls - Always visible on mobile */}
            <div 
              className={`p-3 sm:p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity ${
                showControls ? "opacity-100" : "sm:opacity-0"
              }`}
            >
              {/* Progress bar */}
              <div className="mb-2 sm:mb-3">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer touch-manipulation"
                />
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipBackward}
                    className="text-white hover:bg-white/20 h-9 w-9 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                  >
                    <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20 h-10 w-10 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipForward}
                    className="text-white hover:bg-white/20 h-9 w-9 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                  >
                    <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>

                  <span className="text-white text-xs sm:text-sm ml-1 sm:ml-2 whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Playback speed control */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className="text-white hover:bg-white/20 h-8 px-2 text-xs sm:text-sm font-medium touch-manipulation"
                    >
                      {playbackSpeed}x
                    </Button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg border border-white/20 overflow-hidden min-w-[80px]">
                        {playbackSpeeds.map((speed) => (
                          <button
                            key={speed}
                            onClick={() => changePlaybackSpeed(speed)}
                            className={`w-full px-3 py-2 text-sm text-left hover:bg-white/20 transition-colors ${
                              playbackSpeed === speed ? 'text-primary bg-white/10' : 'text-white'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Volume control - hidden on mobile */}
                  <div className="hidden sm:flex items-center gap-2 group">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>
                    <div className="w-24 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        min={0}
                        max={1}
                        step={0.1}
                        onValueChange={handleVolumeChange}
                      />
                    </div>
                  </div>

                  {/* Mute button for mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="sm:hidden text-white hover:bg-white/20 h-9 w-9 touch-manipulation active:scale-95"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20 h-9 w-9 sm:h-10 sm:w-10 touch-manipulation active:scale-95"
                  >
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "audio":
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center">
              <FileText className="w-16 h-16 text-primary" />
            </div>
            <p className="text-lg font-medium text-foreground">{file.name}</p>
            <audio src={fileUrl} controls className="w-full max-w-md">
              Your browser does not support the audio tag.
            </audio>
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

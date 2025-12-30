import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/fileService";
import { 
  Download, X, FileText, File, Loader2,
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { UniversalImageViewer } from "@/components/media/UniversalImageViewer";

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
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  useEffect(() => {
    if (open && file) {
      loadFileUrl();
      setMediaError(null);
    } else {
      if (fileUrl && fileUrl.startsWith("blob:")) {
        URL.revokeObjectURL(fileUrl);
      }
      setFileUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      setShowSpeedMenu(false);
      setMediaError(null);
    }
  }, [open, file]);

  const loadFileUrl = async () => {
    if (!file || !guestId) return;
    setLoading(true);
    try {
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
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.wma'];
    if (file) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (videoExtensions.includes(ext)) return "video";
      if (audioExtensions.includes(ext)) return "audio";
    }
    return "other";
  };

  // Audio player controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(err => {
          console.error('Playback error:', err);
          setMediaError('Unable to play this file. The format may not be supported.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (audio) {
      const newVolume = value[0];
      audio.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const handleMediaEnded = () => {
    setIsPlaying(false);
  };

  const handleMediaError = () => {
    setMediaError('Unable to play this file. The format may not be supported by your browser.');
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.min(audio.currentTime + 10, duration);
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(audio.currentTime - 10, 0);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const renderPreview = () => {
    if (!file || !fileUrl) return null;

    const fileType = getFileType(file.mime_type);

    switch (fileType) {
      case "image":
        return (
          <UniversalImageViewer
            src={fileUrl}
            alt={file.name}
            showControls={true}
          />
        );

      case "video":
        return (
          <VideoPlayer 
            src={fileUrl} 
            onError={() => setMediaError('Unable to play this file.')}
            crossOrigin={false}
          />
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
            
            {mediaError && (
              <div className="text-destructive text-sm text-center px-4">
                {mediaError}
              </div>
            )}
            
            {/* Audio controls */}
            <div className="w-full max-w-md space-y-3">
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
              
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBackward}
                  className="h-10 w-10 rounded-full touch-manipulation"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="h-12 w-12 rounded-full bg-primary/10 touch-manipulation"
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
                  className="h-10 w-10 rounded-full touch-manipulation"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="h-8 px-2 text-sm"
                  >
                    {playbackSpeed}x
                  </Button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 left-0 bg-popover border rounded-lg shadow-lg overflow-hidden min-w-[70px] z-50">
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
  const isVideoOrImage = fileType === "video" || fileType === "image";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden ${
          isVideoOrImage ? 'max-h-[95vh]' : 'max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {file?.name || "File Preview"}
            </h3>
            <p className="text-xs text-muted-foreground">{file?.mime_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={downloading || !fileUrl}
              className="h-9 w-9"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 flex flex-col min-h-0 ${
          isVideoOrImage ? 'p-0' : 'p-4 overflow-auto'
        }`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : fileUrl ? (
            renderPreview()
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-muted-foreground">Unable to load preview</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

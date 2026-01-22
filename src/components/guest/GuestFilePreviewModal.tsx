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

// Stream mode type - decided BEFORE mounting any player
type StreamMode = 'mp4' | 'audio' | 'image' | 'pdf' | 'other';

interface ResolvedStream {
  mode: StreamMode;
  url: string;
  fallbackUrl?: string;
}

export function GuestFilePreviewModal({ file, guestId, open, onOpenChange }: GuestFilePreviewModalProps) {
  // Single resolved stream state - decided BEFORE rendering player
  const [stream, setStream] = useState<ResolvedStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // Key to force complete player remount on retry
  const [playerKey, setPlayerKey] = useState(0);

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

  // Determine file type from mime type
  const getFileType = (mimeType: string): StreamMode => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "mp4"; // Will be upgraded to 'hls' if available
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType === "application/pdf") return "pdf";
    
    // Check by extension as fallback
    if (file) {
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v'];
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.wma'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (videoExtensions.includes(ext)) return "mp4";
      if (audioExtensions.includes(ext)) return "audio";
    }
    return "other";
  };

  // CRITICAL: Resolve stream mode BEFORE rendering any player
  const resolveStreamMode = async () => {
    if (!file || !guestId) return;
    
    setLoading(true);
    setMediaError(null);
    setStream(null);
    
    const baseFileType = getFileType(file.mime_type);
    
    try {
      // For video files - get direct MP4 stream URL
      if (baseFileType === 'mp4') {
        console.log('🎬 Resolving video stream...');
        const streamResponse = await supabase.functions.invoke('guest-stream-url', {
          body: { guestId, storagePath: file.storage_path },
        });
        
        if (streamResponse.data?.url) {
          console.log('📹 Using MP4 stream');
          setStream({ mode: 'mp4', url: streamResponse.data.url, fallbackUrl: streamResponse.data.fallbackUrl });
          setLoading(false);
          return;
        }
        
        throw new Error('Failed to get video stream URL');
      }
      
      // For audio files
      if (baseFileType === 'audio') {
        const response = await supabase.functions.invoke('guest-stream-url', {
          body: { guestId, storagePath: file.storage_path },
        });
        
        if (response.data?.url) {
          setStream({ mode: 'audio', url: response.data.url });
          setLoading(false);
          return;
        }
        throw new Error('Failed to get audio stream URL');
      }
      
      // For images, PDFs, and other files
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
        setLoading(false);
        return;
      }

      if (response.data?.url) {
        setStream({ mode: baseFileType, url: response.data.url });
      } else if (response.data instanceof Blob) {
        const blobUrl = URL.createObjectURL(response.data);
        setStream({ mode: baseFileType, url: blobUrl });
      }
    } catch (error) {
      console.error("Error resolving stream:", error);
      setMediaError("Failed to load file. Please try downloading instead.");
      toast({
        title: "Error",
        description: "Failed to load file preview. Try downloading the file instead.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset all state when modal closes or file changes
  useEffect(() => {
    if (open && file) {
      resolveStreamMode();
      setMediaError(null);
    } else {
      // Clean up blob URLs
      if (stream?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(stream.url);
      }
      if (stream?.fallbackUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(stream.fallbackUrl);
      }
      setStream(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      setShowSpeedMenu(false);
      setMediaError(null);
      setPlayerKey(0);
    }
  }, [open, file]);

  // Handle retry - force complete remount with new stream resolution
  const handleRetry = () => {
    setMediaError(null);
    setStream(null);
    setPlayerKey(prev => prev + 1);
    resolveStreamMode();
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

  // Render the correct player based on resolved stream mode
  const renderPreview = () => {
    if (!file || !stream) return null;

    // Show error state with retry
    if (mediaError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="text-destructive text-center">{mediaError}</div>
          <Button variant="outline" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      );
    }

    switch (stream.mode) {
      case "image":
        return (
          <UniversalImageViewer
            src={stream.url}
            alt={file.name}
            showControls={true}
          />
        );

      case "mp4":
        // Direct MP4 stream - render VideoPlayer only
        return (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <div className="w-full h-full max-h-[70vh]">
              <VideoPlayer 
                key={`mp4-${playerKey}`}
                src={stream.url}
                fallbackSrc={stream.fallbackUrl}
                onError={() => {
                  setMediaError('Unable to play this file. Please try again or download it.');
                }}
              />
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
              key={`audio-${playerKey}`}
              ref={audioRef}
              src={stream.url}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleMediaEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={handleMediaError}
              className="hidden"
            />
            
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
              src={`${stream.url}#toolbar=1&navpanes=0`}
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

  const isVideoOrImage = stream?.mode === "mp4" || stream?.mode === "image";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl w-[95vw] h-[100dvh] max-h-[95dvh] p-0 gap-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background shrink-0 flex-none">
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
              disabled={downloading || !stream?.url}
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
        <div className={`flex-1 min-h-0 overflow-hidden flex flex-col ${
          isVideoOrImage ? 'p-0 items-center justify-center' : 'p-4 overflow-auto'
        }`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : stream ? (
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

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { FileItem, formatFileSize } from "@/lib/fileService";
import { supabase } from "@/integrations/supabase/client";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import { 
  Download, X, File, Loader2,
  Play, Pause, SkipBack, SkipForward,
  ChevronLeft, ChevronRight, Image, Info, Music, FileVideo
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { HLSPlayer } from "@/components/media/HLSPlayer";
import { UniversalImageViewer } from "@/components/media/UniversalImageViewer";

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
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [rawVideoUrl, setRawVideoUrl] = useState<string | null>(null); // Direct VPS fallback
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [vpsOnline, setVpsOnline] = useState(true);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // Gallery state
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Store previous blob URL to revoke on cleanup
  const previousBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && file) {
      loadFileUrl();
      setMediaError(null);
    } else {
      // Only revoke when modal closes, not on re-renders
      if (previousBlobUrlRef.current) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
        previousBlobUrlRef.current = null;
      }
      setFileUrl(null);
      setHlsUrl(null);
      setRawVideoUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackSpeed(1);
      setShowSpeedMenu(false);
      setMediaError(null);
      setShowInfo(false);
      setVpsOnline(true);
    }
    
    // Cleanup on unmount
    return () => {
      if (previousBlobUrlRef.current) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
        previousBlobUrlRef.current = null;
      }
    };
  }, [open, file?.id]); // Use file.id instead of file object to prevent unnecessary re-runs

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

  const loadFileUrl = async (retryCount = 0) => {
    if (!file) return;
    setLoading(true);
    setHlsUrl(null);
    setRawVideoUrl(null);
    setMediaError(null);
    
    const MAX_RETRIES = 2;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      // Track view (non-blocking)
      supabase.functions.invoke('track-file-view', {
        body: {
          fileId: file.id,
          viewType: 'preview',
          bytesTransferred: file.size_bytes
        }
      }).catch((err) => console.error('Failed to track view:', err));

      const isVideo = file.mime_type.startsWith('video/');
      
      // Always use edge function as proxy (handles HTTPS/CORS properly)
      // The edge function will try VPS first, then fall back to Supabase storage
      const fileResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=url`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!fileResponse.ok) {
        const errorData = await fileResponse.json().catch(() => ({}));
        const status = fileResponse.status;
        
        // Handle 503 (server unavailable) with retry
        if (status === 503 && retryCount < MAX_RETRIES) {
          console.log(`Server unavailable, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadFileUrl(retryCount + 1);
        }
        
        // Set specific error message based on status
        if (status === 503) {
          setMediaError("Storage server temporarily unavailable. Please try again.");
          setVpsOnline(false);
        } else if (status === 401 || status === 403) {
          setMediaError("You don't have permission to view this file.");
        } else {
          setMediaError(errorData.error || "Failed to load file");
        }
        return;
      }

      const urlData = await fileResponse.json();
      
      if (isVideo) {
        // For videos, check if HLS is available via edge function
        await checkHLSAvailability(file.storage_path);
        // Set raw video URL as fallback
        setRawVideoUrl(urlData.url);
      }
      
      setFileUrl(urlData.url);
      setVpsOnline(urlData.storage === 'vps');
      setMediaError(null);
    } catch (error) {
      console.error("Error loading file:", error);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES) {
        console.log(`Network error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return loadFileUrl(retryCount + 1);
      }
      
      setMediaError("Connection failed. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Check if HLS version is available for video via edge function
  const checkHLSAvailability = async (storagePath: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      // Use edge function to check HLS availability (avoids mixed content issues)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-hls-url?storagePath=${encodeURIComponent(storagePath)}`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.signedUrl) {
          console.log('HLS available:', data.signedUrl);
          setHlsUrl(data.signedUrl);
        }
      }
    } catch (error) {
      // Silently fail - fall back to MP4
      console.debug('HLS check failed, using MP4 fallback:', error);
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

      // Track download (non-blocking)
      supabase.functions.invoke('track-file-view', {
        body: {
          fileId: file.id,
          viewType: 'download',
          bytesTransferred: file.size_bytes
        }
      }).catch((err) => console.error('Failed to track download:', err));

      let downloadUrl: string;
      let fetchOptions: RequestInit = {};
      
      // Always use edge function as proxy for secure downloads
      downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=get`;
      fetchOptions = {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      };
      
      const response = await fetch(downloadUrl, fetchOptions);
      
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

  // Audio player controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (audio) {
      lightHaptic();
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
      lightHaptic();
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
      lightHaptic();
      audio.currentTime = Math.min(audio.currentTime + 10, duration);
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (audio) {
      lightHaptic();
      audio.currentTime = Math.max(audio.currentTime - 10, 0);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    const audio = audioRef.current;
    if (audio) {
      lightHaptic();
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
            key={file.id}
            src={fileUrl}
            alt={file.name}
            showControls={true}
            onNavigatePrev={currentIndex > 0 ? () => navigateGallery(-1) : undefined}
            onNavigateNext={currentIndex < mediaFiles.length - 1 ? () => navigateGallery(1) : undefined}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < mediaFiles.length - 1}
          />
        );

      case "video":
        return (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <div className="w-full h-full max-h-[70vh]">
              {hlsUrl ? (
                <HLSPlayer 
                  src={hlsUrl}
                  fallbackSrc={rawVideoUrl || fileUrl}
                  onError={(err) => {
                    console.warn('HLS playback failed, falling back to MP4:', err);
                    setHlsUrl(null); // Clear HLS to fall back to VideoPlayer
                  }}
                />
              ) : (
                <VideoPlayer 
                  src={fileUrl}
                  fallbackSrc={rawVideoUrl || undefined}
                  onError={() => setMediaError('Unable to play this file.')}
                  crossOrigin={!vpsOnline} // Only use crossOrigin for edge function URLs
                />
              )}
            </div>
          </div>
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
              
              <div className="flex items-center justify-between">
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="h-9 px-3 rounded-lg bg-white/[0.05] border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-all"
                  >
                    {playbackSpeed}x
                  </motion.button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 left-0 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden min-w-[80px] z-50 shadow-xl">
                      {playbackSpeeds.map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changePlaybackSpeed(speed)}
                          className={`w-full px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors ${
                            playbackSpeed === speed ? 'text-gold bg-white/5' : 'text-white'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMute}
                    className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-all"
                  >
                    <Music className="w-4 h-4" />
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
  const isVideoOrImage = fileType === "video" || fileType === "image";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        ref={modalContainerRef}
        className="max-w-6xl w-[95vw] h-[100dvh] max-h-[95dvh] p-0 gap-0 overflow-hidden bg-black/95 backdrop-blur-2xl border-white/10 rounded-3xl flex flex-col"
      >
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.06] bg-white/[0.02] shrink-0"
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
        <div className={`flex-1 min-h-0 overflow-hidden ${
          isVideoOrImage ? 'p-0 flex items-center justify-center' : 'p-4 overflow-auto'
        }`}>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center min-h-[400px]"
              >
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-gold" />
                  <p className="text-white/40 text-sm">Loading preview...</p>
                </div>
              </motion.div>
            ) : fileUrl ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {renderPreview()}
              </motion.div>
            ) : (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <File className="w-8 h-8 text-red-400" />
                </div>
                <div className="text-center max-w-md">
                  <p className="text-white/60 font-medium">
                    {mediaError || "Unable to load preview"}
                  </p>
                  {!vpsOnline && (
                    <p className="text-white/30 text-sm mt-1">
                      The storage server may be temporarily offline
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => loadFileUrl()}
                  variant="outline"
                  className="mt-2 rounded-xl border-white/10 hover:bg-white/5"
                >
                  <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : 'hidden'}`} />
                  Try Again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Gallery navigation for images */}
        {mediaFiles.length > 1 && fileType === 'image' && (
          <>
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: currentIndex > 0 ? 1 : 0.3, x: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigateGallery(-1)}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

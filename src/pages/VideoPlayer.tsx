/**
 * VideoPlayer Page - Dedicated full-screen video playback
 * 
 * Opens in a separate tab with its own URL for YouTube/Netflix-style experience.
 * Supports HLS adaptive streaming and direct MP4 playback.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HLSPlayer } from "@/components/media/HLSPlayer";
import { useVideoStream } from "@/hooks/useVideoStream";
import { ArrowLeft, Loader2, AlertTriangle, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoPlayer() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [showHeader, setShowHeader] = useState(true);
  
  const { 
    streamUrl, 
    hlsUrl, 
    fallbackUrl, 
    isLoading, 
    error, 
    preferHls,
    fileInfo 
  } = useVideoStream(fileId);

  // Auto-hide header after 3 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowHeader(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowHeader(false), 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchstart", handleMouseMove);
    
    // Initial timeout
    timeout = setTimeout(() => setShowHeader(false), 3000);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchstart", handleMouseMove);
    };
  }, []);

  // Update document title
  useEffect(() => {
    if (fileInfo?.originalName) {
      document.title = `${fileInfo.originalName} - Video Player`;
    }
    return () => {
      document.title = "Nebula";
    };
  }, [fileInfo?.originalName]);

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard/files");
    }
  };

  // Determine which URL to use
  const videoSrc = preferHls && hlsUrl ? hlsUrl : streamUrl;
  const videoFallback = fallbackUrl || streamUrl;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !videoSrc) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Unable to play video</h2>
          <p className="text-muted-foreground">
            {error || "Video file not found or access denied."}
          </p>
          <Button 
            onClick={handleBack}
            variant="outline"
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Floating Header */}
      <motion.header
        initial={{ opacity: 1, y: 0 }}
        animate={{ 
          opacity: showHeader ? 1 : 0, 
          y: showHeader ? 0 : -20 
        }}
        transition={{ duration: 0.3 }}
        className="absolute top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ pointerEvents: showHeader ? "auto" : "none" }}
      >
        <div className="px-4 py-3 flex items-center gap-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-white hover:bg-white/10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <FileVideo className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-medium truncate">
                {fileInfo?.originalName || "Video"}
              </h1>
              {fileInfo?.size && (
                <p className="text-white/60 text-xs">
                  {formatFileSize(fileInfo.size)}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Video Player - Full Screen */}
      <HLSPlayer
        src={videoSrc}
        fallbackSrc={videoFallback}
        poster={fileInfo?.thumbnailUrl}
        className="w-full h-full"
        onError={(err) => console.error("Video playback error:", err)}
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

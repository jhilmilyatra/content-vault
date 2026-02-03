/**
 * VideoPlayer Page - Dedicated full-screen video playback
 * 
 * Opens in a separate tab with its own URL for YouTube/Netflix-style experience.
 * Uses direct MP4 streaming for optimal compatibility.
 * Includes resume functionality - saves and restores playback position.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { VideoPlayer as VideoPlayerComponent } from "@/components/media/VideoPlayer";
import { useVideoStream } from "@/hooks/useVideoStream";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/contexts/FeatureFlagsContext";
import { FeatureDisabled } from "@/components/FeatureDisabled";
import { ArrowLeft, Loader2, AlertTriangle, FileVideo, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoPlayer() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoStreamingEnabled = useFeatureFlag("feature_video_streaming");
  const [showHeader, setShowHeader] = useState(true);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  
  const { 
    streamUrl, 
    fallbackUrl,
    qualities,
    isLoading: streamLoading, 
    error, 
    fileInfo,
    keepAlive,
  } = useVideoStream(fileId);

  const {
    progress,
    isLoading: progressLoading,
    saveProgress,
    markCompleted,
  } = useVideoProgress(fileId, user?.id);

  // Preload video URLs at page level for faster initial buffering
  useEffect(() => {
    if (!streamUrl) return;
    
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'video';
    preloadLink.href = streamUrl;
    document.head.appendChild(preloadLink);

    let fallbackPreloadLink: HTMLLinkElement | null = null;
    if (fallbackUrl) {
      fallbackPreloadLink = document.createElement('link');
      fallbackPreloadLink.rel = 'preload';
      fallbackPreloadLink.as = 'video';
      fallbackPreloadLink.href = fallbackUrl;
      document.head.appendChild(fallbackPreloadLink);
    }

    return () => {
      preloadLink.remove();
      fallbackPreloadLink?.remove();
    };
  }, [streamUrl, fallbackUrl]);

  // Check if we should show resume prompt
  useEffect(() => {
    if (progress && !progress.completed && progress.positionSeconds > 10) {
      setResumePosition(progress.positionSeconds);
      setShowResumePrompt(true);
      // Auto-hide after 5 seconds
      const timeout = setTimeout(() => setShowResumePrompt(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [progress]);

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

  // Handle time updates (save progress + keep stream warm)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    saveProgress(currentTime, duration);
    // Keep stream warm every 5 minutes during playback
    keepAlive();
  }, [saveProgress, keepAlive]);

  // Handle video ended
  const handleEnded = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  // Check feature flag - show disabled state (after all hooks)
  if (!videoStreamingEnabled) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <FeatureDisabled 
          featureName="Video Streaming" 
          message="Video streaming has been temporarily disabled. Please try again later."
        />
      </div>
    );
  }

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard/files");
    }
  };

  // Handle resume
  const handleResume = () => {
    setShowResumePrompt(false);
  };

  // Handle start from beginning
  const handleStartOver = () => {
    setResumePosition(null);
    setShowResumePrompt(false);
  };

  const isLoading = streamLoading || progressLoading;
  const videoSrc = streamUrl;
  const videoFallback = fallbackUrl;

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

      {/* Resume Prompt */}
      <AnimatePresence>
        {showResumePrompt && resumePosition && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 px-6 py-4 flex items-center gap-4 shadow-2xl">
              <RotateCcw className="w-5 h-5 text-primary" />
              <div className="text-sm">
                <p className="text-white">Resume from {formatTime(resumePosition)}?</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartOver}
                  className="text-white/70 hover:text-white"
                >
                  Start Over
                </Button>
                <Button
                  size="sm"
                  onClick={handleResume}
                  className="bg-primary hover:bg-primary/90"
                >
                  Resume
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player - Full Screen */}
      <VideoPlayerComponent
        src={videoSrc}
        fallbackSrc={videoFallback}
        qualities={qualities.length > 1 ? qualities : undefined}
        poster={fileInfo?.thumbnailUrl}
        className="w-full h-full"
        initialTime={resumePosition || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => console.error("Video playback error")}
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

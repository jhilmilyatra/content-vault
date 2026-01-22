/**
 * GuestVideoPlayer - Dedicated full-screen video playback for guest users
 * 
 * Separate route for YouTube/Netflix-style video experience.
 * Uses direct MP4 streaming for optimal compatibility.
 * Includes resume functionality - saves and restores playback position.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { useGuestVideoProgress } from "@/hooks/useVideoProgress";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, AlertTriangle, FileVideo, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileInfo {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  durationSeconds?: number | null;
}

interface StreamData {
  url: string;
  fallbackUrl?: string;
}

export default function GuestVideoPlayer() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { guest, loading: authLoading } = useGuestAuth();
  const [showHeader, setShowHeader] = useState(true);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  
  const [stream, setStream] = useState<StreamData | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    progress,
    isLoading: progressLoading,
    saveProgress,
    markCompleted,
  } = useGuestVideoProgress(fileId, guest?.id);

  // Preload video URLs at page level for faster initial buffering
  useEffect(() => {
    if (!stream?.url) return;
    
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'video';
    preloadLink.href = stream.url;
    document.head.appendChild(preloadLink);

    let fallbackPreloadLink: HTMLLinkElement | null = null;
    if (stream.fallbackUrl) {
      fallbackPreloadLink = document.createElement('link');
      fallbackPreloadLink.rel = 'preload';
      fallbackPreloadLink.as = 'video';
      fallbackPreloadLink.href = stream.fallbackUrl;
      document.head.appendChild(fallbackPreloadLink);
    }

    return () => {
      preloadLink.remove();
      fallbackPreloadLink?.remove();
    };
  }, [stream]);

  // Check if we should show resume prompt
  useEffect(() => {
    if (progress && !progress.completed && progress.positionSeconds > 10) {
      setResumePosition(progress.positionSeconds);
      setShowResumePrompt(true);
      const timeout = setTimeout(() => setShowResumePrompt(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !guest) {
      navigate('/guest-auth');
    }
  }, [guest, authLoading, navigate]);

  // Fetch video stream URL
  useEffect(() => {
    const fetchStream = async () => {
      if (!guest || !fileId) return;

      setIsLoading(true);
      setError(null);

      try {
        // First get file info
        const fileResponse = await supabase.functions.invoke('guest-folder-contents', {
          body: {
            guestId: guest.id,
            fileId,
            action: 'get-file-info',
          },
        });

        if (fileResponse.error || !fileResponse.data?.file) {
          throw new Error('File not found or access denied');
        }

        const file = fileResponse.data.file;
        setFileInfo({
          id: file.id,
          name: file.name,
          originalName: file.original_name,
          mimeType: file.mime_type,
          size: file.size_bytes,
          storagePath: file.storage_path,
          durationSeconds: file.duration_seconds,
        });

        // Get direct stream URL for MP4 playback
        const streamResponse = await supabase.functions.invoke('guest-stream-url', {
          body: { guestId: guest.id, storagePath: file.storage_path },
        });

        if (streamResponse.data?.url) {
          setStream({ url: streamResponse.data.url, fallbackUrl: streamResponse.data.fallbackUrl });
        } else {
          throw new Error('Failed to get video stream URL');
        }
      } catch (err) {
        console.error('Failed to load video:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();
  }, [guest, fileId]);

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
      document.title = `${fileInfo.originalName} - Video`;
    }
    return () => {
      document.title = "Nebula";
    };
  }, [fileInfo?.originalName]);

  // Handle time updates (save progress)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    saveProgress(currentTime, duration);
  }, [saveProgress]);

  // Handle video ended
  const handleEnded = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/guest-portal");
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

  const isLoadingAll = authLoading || isLoading || progressLoading;

  if (isLoadingAll) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !stream) {
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
          <Button onClick={handleBack} variant="outline" className="mt-4">
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
          y: showHeader ? 0 : -20,
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
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-medium truncate">
                {fileInfo?.originalName || "Video"}
              </h1>
              {(fileInfo?.size || fileInfo?.durationSeconds) && (
                <p className="text-white/60 text-xs flex items-center gap-2">
                  {fileInfo?.durationSeconds && (
                    <span>{formatTime(fileInfo.durationSeconds)}</span>
                  )}
                  {fileInfo?.durationSeconds && fileInfo?.size && (
                    <span>•</span>
                  )}
                  {fileInfo?.size && (
                    <span>{formatFileSize(fileInfo.size)}</span>
                  )}
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

      {/* Video Player */}
      <VideoPlayer
        src={stream.url}
        fallbackSrc={stream.fallbackUrl}
        className="w-full h-full"
        initialTime={resumePosition || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => setError('Unable to play this video')}
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

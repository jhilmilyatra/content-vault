/**
 * GuestVideoPlayer - Dedicated full-screen video playback for guest users
 * 
 * Separate route for YouTube/Netflix-style video experience.
 * Supports HLS adaptive streaming and direct MP4 playback.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HLSPlayer } from "@/components/media/HLSPlayer";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, AlertTriangle, FileVideo, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileInfo {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

interface StreamData {
  mode: 'hls' | 'mp4';
  url: string;
  fallbackUrl?: string;
}

export default function GuestVideoPlayer() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { guest, loading: authLoading } = useGuestAuth();
  const [showHeader, setShowHeader] = useState(true);
  
  const [stream, setStream] = useState<StreamData | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        });

        // Try HLS first
        try {
          const hlsResponse = await supabase.functions.invoke('guest-hls-url', {
            body: {
              guestId: guest.id,
              storagePath: file.storage_path,
            },
          });

          if (!hlsResponse.error && hlsResponse.data) {
            const { type, url, hlsAvailable } = hlsResponse.data;

            if (type === 'hls' && hlsAvailable && url) {
              // Get fallback MP4 URL
              let fallbackUrl: string | undefined;
              try {
                const streamResponse = await supabase.functions.invoke('guest-stream-url', {
                  body: { guestId: guest.id, storagePath: file.storage_path },
                });
                if (streamResponse.data?.url) {
                  fallbackUrl = streamResponse.data.url;
                }
              } catch (e) {
                console.warn('Could not get fallback URL:', e);
              }

              setStream({ mode: 'hls', url, fallbackUrl });
              setIsLoading(false);
              return;
            }

            // HLS not available, use returned URL as MP4
            if (url) {
              setStream({ mode: 'mp4', url });
              setIsLoading(false);
              return;
            }
          }
        } catch (hlsError) {
          console.warn('HLS check failed, falling back to direct stream:', hlsError);
        }

        // Fallback: get direct stream URL
        const streamResponse = await supabase.functions.invoke('guest-stream-url', {
          body: { guestId: guest.id, storagePath: file.storage_path },
        });

        if (streamResponse.data?.url) {
          setStream({ mode: 'mp4', url: streamResponse.data.url });
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

  // Handle back navigation
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/guest-portal");
    }
  };

  if (authLoading || isLoading) {
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
              {fileInfo?.size && (
                <p className="text-white/60 text-xs">
                  {formatFileSize(fileInfo.size)}
                </p>
              )}
            </div>
            {stream.mode === 'hls' && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 text-xs text-white/90">
                <Wifi className="w-3 h-3 text-green-400" />
                <span>Adaptive</span>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Video Player */}
      {stream.mode === 'hls' ? (
        <HLSPlayer
          src={stream.url}
          fallbackSrc={stream.fallbackUrl}
          className="w-full h-full"
          onError={(err) => console.error("Video playback error:", err)}
        />
      ) : (
        <VideoPlayer
          src={stream.url}
          className="w-full h-full"
          onError={() => setError('Unable to play this video')}
          crossOrigin={false}
        />
      )}
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

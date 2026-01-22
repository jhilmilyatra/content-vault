import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Clock, ArrowUpRight, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { warmVideoStreamUrl, getCachedVideoStreamUrl } from "@/lib/videoStreamCache";

interface VideoWithProgress {
  id: string;
  file_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  progress_percent: number | null;
  last_watched_at: string;
  file: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    storage_path: string;
  };
  // Cache status for UI indicator
  isCached?: boolean;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function ContinueWatching() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [warmingStatus, setWarmingStatus] = useState<Record<string, boolean>>({});
  const hoverTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Warm a single video URL (used for hover prefetch)
  const warmSingleVideo = useCallback(async (video: VideoWithProgress) => {
    const storagePath = video.file.storage_path;
    if (!storagePath || warmingStatus[video.file_id]) return;

    // Check if already cached
    const cached = getCachedVideoStreamUrl(storagePath);
    if (cached.url) {
      setWarmingStatus(prev => ({ ...prev, [video.file_id]: true }));
      return;
    }

    try {
      await warmVideoStreamUrl(video.file_id, storagePath, { priority: 'high' });
      setWarmingStatus(prev => ({ ...prev, [video.file_id]: true }));
    } catch {
      // Silent fail
    }
  }, [warmingStatus]);

  // Hover prefetch handler with 150ms debounce
  const handleHoverStart = useCallback((video: VideoWithProgress) => {
    // Clear any existing timeout for this video
    if (hoverTimeoutRef.current[video.file_id]) {
      clearTimeout(hoverTimeoutRef.current[video.file_id]);
    }

    // Start warming after 150ms of hover (debounce quick pass-overs)
    hoverTimeoutRef.current[video.file_id] = setTimeout(() => {
      warmSingleVideo(video);
    }, 150);
  }, [warmSingleVideo]);

  const handleHoverEnd = useCallback((fileId: string) => {
    // Cancel warming if user leaves before debounce completes
    if (hoverTimeoutRef.current[fileId]) {
      clearTimeout(hoverTimeoutRef.current[fileId]);
      delete hoverTimeoutRef.current[fileId];
    }
  }, []);

  // Pre-warm video stream URLs for instant playback (background batch)
  const warmVideoUrls = useCallback(async (videoList: VideoWithProgress[]) => {
    const warmingPromises = videoList.map(async (video) => {
      const storagePath = video.file.storage_path;
      if (!storagePath) return;

      // Check if already cached
      const cached = getCachedVideoStreamUrl(storagePath);
      if (cached.url) {
        setWarmingStatus(prev => ({ ...prev, [video.file_id]: true }));
        return;
      }

      // Warm the URL in background
      try {
        await warmVideoStreamUrl(video.file_id, storagePath, { priority: 'low' });
        setWarmingStatus(prev => ({ ...prev, [video.file_id]: true }));
      } catch {
        // Silent fail - not critical
      }
    });

    // Process in parallel (max 3 at a time)
    const BATCH_SIZE = 3;
    for (let i = 0; i < warmingPromises.length; i += BATCH_SIZE) {
      await Promise.all(warmingPromises.slice(i, i + BATCH_SIZE));
    }
  }, []);

  // Cleanup hover timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(hoverTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const fetchContinueWatching = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("video_progress")
          .select(`
            id,
            file_id,
            position_seconds,
            duration_seconds,
            progress_percent,
            last_watched_at,
            file:files!video_progress_file_id_fkey (
              id,
              name,
              thumbnail_url,
              storage_path
            )
          `)
          .eq("user_id", user.id)
          .eq("completed", false)
          .gt("position_seconds", 10)
          .order("last_watched_at", { ascending: false })
          .limit(6);

        if (error) throw error;

        // Filter out entries without valid file data
        const validVideos = (data || []).filter(
          (v) => v.file && typeof v.file === "object" && "id" in v.file
        ) as VideoWithProgress[];

        setVideos(validVideos);

        // Pre-warm video URLs for instant playback
        if (validVideos.length > 0) {
          warmVideoUrls(validVideos);
        }
      } catch (error) {
        console.error("Error fetching continue watching:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContinueWatching();
  }, [user, warmVideoUrls]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Continue Watching</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard/watch-history')}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            View history
            <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.18 }}
      className="bg-card border border-border rounded-lg"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">Continue Watching</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/dashboard/watch-history')}
          className="text-xs text-muted-foreground hover:text-foreground h-8"
        >
          View history
          <ArrowUpRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((video, index) => (
          <motion.button
            key={video.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => navigate(`/dashboard/video/${video.file_id}`)}
            onMouseEnter={() => handleHoverStart(video)}
            onMouseLeave={() => handleHoverEnd(video.file_id)}
            onFocus={() => handleHoverStart(video)}
            onBlur={() => handleHoverEnd(video.file_id)}
            className={cn(
              "group text-left rounded-lg overflow-hidden",
              "bg-muted/30 hover:bg-muted/50 transition-all",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-muted">
              {video.file.thumbnail_url ? (
                <img
                  src={video.file.thumbnail_url}
                  alt={video.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground/50" />
                </div>
              )}

              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary-foreground fill-current" />
                </div>
              </div>

              {/* Time remaining badge */}
              {video.duration_seconds && (
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium">
                  {formatDuration(video.duration_seconds - video.position_seconds)} left
                </div>
              )}

              {/* Instant playback indicator (cached) */}
              {warmingStatus[video.file_id] && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/90 text-[9px] text-primary-foreground font-medium">
                  <Zap className="w-2.5 h-2.5" />
                  Instant
                </div>
              )}

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${video.progress_percent || 0}%` }}
                />
              </div>
            </div>

            {/* Info */}
            <div className="p-2">
              <p className="text-xs font-medium text-foreground truncate">
                {video.file.name}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(video.last_watched_at)}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

export default ContinueWatching;

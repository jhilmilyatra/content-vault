import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  };
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
              thumbnail_url
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
      } catch (error) {
        console.error("Error fetching continue watching:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContinueWatching();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Play className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Continue Watching</h2>
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
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Play className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Continue Watching</h2>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((video, index) => (
          <motion.button
            key={video.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            onClick={() => navigate(`/dashboard/video/${video.file_id}`)}
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

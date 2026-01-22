import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { Play, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuestVideoProgress {
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

export function GuestContinueWatching() {
  const { guest } = useGuestAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<GuestVideoProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContinueWatching = async () => {
      if (!guest) return;

      try {
        // Fetch guest video progress with file info
        const { data, error } = await supabase
          .from("guest_video_progress")
          .select(`
            id,
            file_id,
            position_seconds,
            duration_seconds,
            progress_percent,
            last_watched_at,
            file:files!guest_video_progress_file_id_fkey (
              id,
              name,
              thumbnail_url
            )
          `)
          .eq("guest_id", guest.id)
          .eq("completed", false)
          .gt("position_seconds", 10)
          .order("last_watched_at", { ascending: false })
          .limit(6);

        if (error) throw error;

        // Filter valid entries with file data
        const validVideos = (data || []).filter(
          (v) => v.file && typeof v.file === "object" && "id" in v.file
        ) as GuestVideoProgress[];

        setVideos(validVideos);
      } catch (error) {
        console.error("Error fetching guest continue watching:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchContinueWatching();
  }, [guest]);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Play className="w-4 h-4 text-violet-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Continue Watching</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-video rounded-lg bg-white/5" />
              <div className="h-4 w-3/4 rounded bg-white/5" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
      className="glass-card p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center border border-violet-500/10">
            <Play className="w-4 h-4 text-violet-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Continue Watching</h3>
        </div>
        <span className="text-xs text-white/40">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((video, index) => (
          <motion.button
            key={video.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            onClick={() => navigate(`/guest-portal/video/${video.file_id}`)}
            className={cn(
              "group text-left rounded-xl overflow-hidden",
              "bg-white/5 hover:bg-white/10 transition-all duration-300",
              "focus:outline-none focus:ring-2 focus:ring-violet-500/50",
              "border border-white/5 hover:border-violet-500/20"
            )}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black/20">
              {video.file.thumbnail_url ? (
                <img
                  src={video.file.thumbnail_url}
                  alt={video.file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/20 to-purple-900/20">
                  <Play className="w-8 h-8 text-white/20" />
                </div>
              )}

              {/* Play overlay on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 transform group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                </div>
              </div>

              {/* Time remaining badge */}
              {video.duration_seconds && (
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-medium backdrop-blur-sm">
                  {formatDuration(video.duration_seconds - video.position_seconds)} left
                </div>
              )}

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${video.progress_percent || 0}%` }}
                  transition={{ delay: index * 0.05 + 0.2, duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                />
              </div>
            </div>

            {/* Info */}
            <div className="p-2.5">
              <p className="text-xs font-medium text-white truncate group-hover:text-violet-200 transition-colors">
                {video.file.name}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/40">
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

export default GuestContinueWatching;

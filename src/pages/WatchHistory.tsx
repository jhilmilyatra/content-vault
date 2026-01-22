import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Play, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  History,
  Search,
  X
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VideoHistoryItem {
  id: string;
  file_id: string;
  position_seconds: number;
  duration_seconds: number | null;
  progress_percent: number | null;
  completed: boolean;
  last_watched_at: string;
  created_at: string;
  file: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    mime_type: string;
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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }
};

const WatchHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
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
          completed,
          last_watched_at,
          created_at,
          file:files!video_progress_file_id_fkey (
            id,
            name,
            thumbnail_url,
            mime_type
          )
        `)
        .eq("user_id", user.id)
        .order("last_watched_at", { ascending: false });

      if (error) throw error;

      const validHistory = (data || []).filter(
        (v) => v.file && typeof v.file === "object" && "id" in v.file
      ) as VideoHistoryItem[];

      setHistory(validHistory);
    } catch (error) {
      console.error("Error fetching watch history:", error);
      toast({
        title: "Error",
        description: "Failed to load watch history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearing(true);

    try {
      const { error } = await supabase
        .from("video_progress")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setHistory([]);
      toast({
        title: "History cleared",
        description: "Your watch history has been cleared",
      });
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        title: "Error",
        description: "Failed to clear watch history",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from("video_progress")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: "Removed",
        description: "Video removed from history",
      });
    } catch (error) {
      console.error("Error removing item:", error);
      toast({
        title: "Error",
        description: "Failed to remove from history",
        variant: "destructive",
      });
    }
  };

  const filteredHistory = history.filter((item) =>
    item.file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by date
  const groupedHistory = filteredHistory.reduce((groups, item) => {
    const date = new Date(item.last_watched_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupKey: string;
    if (date.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      groupKey = "This Week";
    } else if (date > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
      groupKey = "This Month";
    } else {
      groupKey = "Older";
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, VideoHistoryItem[]>);

  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Watch History</h1>
                <p className="text-sm text-muted-foreground">
                  {history.length} video{history.length !== 1 ? "s" : ""} watched
                </p>
              </div>
            </div>

            {history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear watch history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entire watch history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAll}
                      disabled={clearing}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {clearing ? "Clearing..." : "Clear All"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </motion.div>

          {/* Search */}
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search watch history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 bg-card border border-border rounded-lg">
                  <Skeleton className="w-40 h-24 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium text-foreground mb-2">No watch history</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Videos you watch will appear here
              </p>
              <Button onClick={() => navigate("/dashboard/files")}>
                <Play className="w-4 h-4 mr-2" />
                Browse Videos
              </Button>
            </motion.div>
          ) : filteredHistory.length === 0 ? (
            /* No Search Results */
            <div className="text-center py-12">
              <p className="text-muted-foreground">No videos match "{searchQuery}"</p>
            </div>
          ) : (
            /* History List */
            <div className="space-y-6">
              {groupOrder.map((group) => {
                const items = groupedHistory[group];
                if (!items || items.length === 0) return null;

                return (
                  <motion.div
                    key={group}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h3 className="text-sm font-medium text-muted-foreground px-1">
                      {group}
                    </h3>

                    <AnimatePresence mode="popLayout">
                      {items.map((item, index) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            "group flex gap-4 p-3 bg-card border border-border rounded-lg",
                            "hover:bg-muted/30 transition-colors cursor-pointer"
                          )}
                          onClick={() => navigate(`/dashboard/video/${item.file_id}`)}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-36 sm:w-44 flex-shrink-0">
                            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                              {item.file.thumbnail_url ? (
                                <img
                                  src={item.file.thumbnail_url}
                                  alt={item.file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Play className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                              )}

                              {/* Play overlay */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                                  <Play className="w-5 h-5 text-primary-foreground fill-current" />
                                </div>
                              </div>

                              {/* Duration badge */}
                              {item.duration_seconds && (
                                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-medium">
                                  {formatDuration(item.duration_seconds)}
                                </div>
                              )}

                              {/* Progress bar */}
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                                <div
                                  className={cn(
                                    "h-full transition-all",
                                    item.completed ? "bg-emerald-500" : "bg-primary"
                                  )}
                                  style={{ width: `${item.progress_percent || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                            <div>
                              <h4 className="font-medium text-foreground truncate mb-1">
                                {item.file.name}
                              </h4>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(item.last_watched_at)}
                                </span>
                                {item.completed && (
                                  <span className="flex items-center gap-1 text-emerald-500">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Completed
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex-1">
                                <Progress
                                  value={item.progress_percent || 0}
                                  className={cn(
                                    "h-1.5",
                                    item.completed && "[&>div]:bg-emerald-500"
                                  )}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {item.completed
                                  ? "Watched"
                                  : `${Math.round(item.progress_percent || 0)}%`}
                              </span>
                            </div>
                          </div>

                          {/* Remove button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.id);
                            }}
                            className={cn(
                              "self-center p-2 rounded-lg opacity-0 group-hover:opacity-100",
                              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                              "transition-all"
                            )}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default WatchHistory;

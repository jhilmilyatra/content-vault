import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatFileSize } from "@/lib/fileService";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Bot,
  ChevronRight,
  RefreshCw,
  X,
  Loader2
} from "lucide-react";
import { lightHaptic, heavyHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface UploadSession {
  id: string;
  upload_id: string;
  file_name: string;
  total_size: number;
  total_chunks: number;
  uploaded_chunks: number[];
  folder_id: string | null;
  created_at: string;
  expires_at: string;
  mime_type: string;
}

interface RecentUpload {
  id: string;
  name: string;
  size_bytes: number;
  created_at: string;
  mime_type: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export const TelegramUploadTracker = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<UploadSession[]>([]);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch active chunked upload sessions
      const { data: sessions } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (sessions) {
        setActiveSessions(sessions as UploadSession[]);
      }

      // Fetch recent uploads from the last 24 hours (likely from Telegram)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: files } = await supabase
        .from("files")
        .select("id, name, size_bytes, created_at, mime_type")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .gte("created_at", yesterday.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (files) {
        setRecentUploads(files as RecentUpload[]);
      }
    } catch (error) {
      console.error("Error fetching upload data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for upload sessions
    const channel = supabase
      .channel('upload-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chunked_upload_sessions',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'files',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRefresh = () => {
    lightHaptic();
    setRefreshing(true);
    fetchData();
  };

  const handleCancelUpload = async (session: UploadSession) => {
    heavyHaptic();
    
    // Add to cancelling state
    setCancellingIds(prev => new Set(prev).add(session.id));
    
    try {
      // Delete the upload session (this will also trigger cleanup of upload_chunks via trigger)
      const { error } = await supabase
        .from("chunked_upload_sessions")
        .delete()
        .eq("id", session.id)
        .eq("user_id", user?.id);
      
      if (error) {
        throw error;
      }
      
      // Also clean up the upload_chunks table
      await supabase
        .from("upload_chunks")
        .delete()
        .eq("upload_id", session.upload_id);
      
      toast.success(`Cancelled upload: ${session.file_name}`);
      
      // Remove from local state immediately for snappy UI
      setActiveSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (error) {
      console.error("Error cancelling upload:", error);
      toast.error("Failed to cancel upload");
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  };

  const getUploadProgress = (session: UploadSession) => {
    const uploadedCount = session.uploaded_chunks?.length || 0;
    return Math.round((uploadedCount / session.total_chunks) * 100);
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return then.toLocaleDateString();
  };

  // Don't render if no data
  if (!loading && activeSessions.length === 0 && recentUploads.length === 0) {
    return null;
  }

  return (
    <GlassCard variant="elevated">
      <GlassCardHeader 
        title="Telegram Uploads" 
        icon={<Bot className="w-5 h-5 text-primary" />}
        action={
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => {
                lightHaptic();
                navigate('/dashboard/upload-history');
              }}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
            >
              View All
              <ChevronRight className="w-3 h-3" />
            </motion.button>
            <motion.button
              onClick={handleRefresh}
              className="text-sm text-muted-foreground hover:text-primary transition-colors p-1"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted/50 rounded w-3/4" />
                <div className="h-3 bg-muted/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div 
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Active Uploads */}
          {activeSessions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                In Progress
              </p>
              <AnimatePresence>
                {activeSessions.map((session) => {
                  const progress = getUploadProgress(session);
                  const isExpiringSoon = new Date(session.expires_at).getTime() - Date.now() < 3600000;
                  const isCancelling = cancellingIds.has(session.id);
                  
                  return (
                    <motion.div
                      key={session.id}
                      variants={itemVariants}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      className="p-3 rounded-xl ios-glass-subtle space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <Upload className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {session.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatFileSize(session.total_size)} • {session.uploaded_chunks?.length || 0}/{session.total_chunks} chunks
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${progress === 100 ? 'text-emerald-400' : 'text-primary'}`}>
                            {progress}%
                          </span>
                          <motion.button
                            onClick={() => handleCancelUpload(session)}
                            disabled={isCancelling}
                            className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Cancel upload"
                          >
                            {isCancelling ? (
                              <Loader2 className="w-3.5 h-3.5 text-destructive animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-destructive" />
                            )}
                          </motion.button>
                        </div>
                      </div>
                      
                      <Progress value={progress} className="h-1.5" />
                      
                      {isExpiringSoon && progress < 100 && (
                        <p className="text-xs text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Session expiring soon
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Recent Uploads */}
          {recentUploads.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                Recent (24h)
              </p>
              <AnimatePresence>
                {recentUploads.map((file) => (
                  <motion.div
                    key={file.id}
                    variants={itemVariants}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size_bytes)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {getTimeAgo(file.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Empty State */}
          {activeSessions.length === 0 && recentUploads.length === 0 && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No recent Telegram uploads</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Use your Telegram bot to upload files
              </p>
            </div>
          )}
        </motion.div>
      )}
    </GlassCard>
  );
};

export default TelegramUploadTracker;

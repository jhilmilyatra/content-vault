import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/fileService";
import { ContinueWatching } from "@/components/dashboard/ContinueWatching";
import { 
  HardDrive, 
  Link2, 
  ArrowUpRight,
  FolderOpen,
  FileVideo,
  FileImage,
  FileText as FileTextIcon,
  Upload,
  Plus,
  Clock,
  Folder,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface UsageMetrics {
  storage_used_bytes: number;
  bandwidth_used_bytes: number;
  active_links_count: number;
  total_views: number;
  total_downloads: number;
}

interface RecentFile {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface RecentFolder {
  id: string;
  name: string;
  file_count?: number;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith("video/")) return FileVideo;
  if (mimeType?.startsWith("image/")) return FileImage;
  return FileTextIcon;
};

const formatTimeAgo = (dateString: string) => {
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

const Dashboard = () => {
  const { user, profile, subscription, daysRemaining } = useAuth();
  const navigate = useNavigate();
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        const [metricsRes, filesRes, foldersRes] = await Promise.all([
          supabase
            .from("usage_metrics")
            .select("*")
            .eq("user_id", user.id)
            .single(),
          supabase
            .from("files")
            .select("id, name, mime_type, size_bytes, created_at")
            .eq("user_id", user.id)
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("folders")
            .select("id, name")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(4),
        ]);
        
        if (metricsRes.data) {
          setUsageMetrics(metricsRes.data as UsageMetrics);
        }
        if (filesRes.data) {
          setRecentFiles(filesRes.data as RecentFile[]);
        }
        if (foldersRes.data) {
          setRecentFolders(foldersRes.data as RecentFolder[]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const storageUsedBytes = usageMetrics?.storage_used_bytes || 0;
  const storageLimitBytes = (subscription?.storage_limit_gb || 1) * 1024 * 1024 * 1024;
  const storagePercentage = Math.min((storageUsedBytes / storageLimitBytes) * 100, 100);

  const activeLinks = usageMetrics?.active_links_count || 0;
  const maxLinks = subscription?.max_active_links || 5;

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 max-w-5xl">
          {/* Status Strip */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-muted/50 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground">
                Hi, <span className="font-medium">{firstName}</span>
              </span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {subscription?.plan === 'free' ? 'Free Plan' : 'Premium'}
                {daysRemaining !== null && subscription?.plan === 'free' && (
                  <span className="text-primary ml-1">• {daysRemaining} days left</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="w-4 h-4" />
              <span>{Math.round(storagePercentage)}% used</span>
              {storagePercentage > 80 && (
                <span className="text-amber-500 text-xs">• Running low</span>
              )}
            </div>
          </motion.div>

          {/* Primary Action */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Button
              onClick={() => navigate('/dashboard/files')}
              className="h-11 px-6 text-sm font-medium"
              size="lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </motion.div>

          {/* Metrics Cards - Max 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {loading ? (
              <>
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </>
            ) : (
              <>
                {/* Storage */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                  <p className="text-2xl font-semibold text-foreground mb-2">
                    {formatFileSize(storageUsedBytes)}
                  </p>
                  <Progress value={storagePercentage} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    of {subscription?.storage_limit_gb || 1} GB
                  </p>
                </div>

                {/* Active Links */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Active Links</p>
                  <p className="text-2xl font-semibold text-foreground mb-2">
                    {activeLinks}
                  </p>
                  <Progress value={(activeLinks / maxLinks) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    of {maxLinks} links
                  </p>
                </div>

                {/* Bandwidth */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Bandwidth</p>
                  <p className="text-2xl font-semibold text-foreground mb-2">
                    {formatFileSize(usageMetrics?.bandwidth_used_bytes || 0)}
                  </p>
                  <Progress 
                    value={Math.min(((usageMetrics?.bandwidth_used_bytes || 0) / ((subscription?.bandwidth_limit_gb || 10) * 1024 * 1024 * 1024)) * 100, 100)} 
                    className="h-1.5" 
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    of {subscription?.bandwidth_limit_gb || 10} GB
                  </p>
                </div>
              </>
            )}
          </motion.div>

          {/* Continue Watching Section */}
          <ContinueWatching />

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Feed - 2/3 width on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="lg:col-span-2"
            >
              <div className="bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/dashboard/files')}
                    className="text-xs text-muted-foreground hover:text-foreground h-8"
                  >
                    View all
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>

                <div className="divide-y divide-border">
                  {loading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="w-9 h-9 rounded-lg" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-32 mb-1" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentFiles.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                        <FolderOpen className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">No files yet</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/dashboard/files')}
                      >
                        Upload your first file
                      </Button>
                    </div>
                  ) : (
                    recentFiles.map((file) => {
                      const Icon = getFileIcon(file.mime_type);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate('/dashboard/files')}
                        >
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size_bytes)} • Uploaded
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTimeAgo(file.created_at)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>

            {/* Folder Shortcuts - 1/3 width */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <div className="bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-foreground">My Folders</h2>
                  </div>
                </div>

                <div className="p-3 flex flex-wrap gap-2">
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-24 rounded-full" />
                      <Skeleton className="h-8 w-20 rounded-full" />
                      <Skeleton className="h-8 w-28 rounded-full" />
                    </>
                  ) : (
                    <>
                      {recentFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => navigate('/dashboard/files')}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                            "bg-muted/50 hover:bg-muted text-foreground transition-colors"
                          )}
                        >
                          <Folder className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{folder.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => navigate('/dashboard/files')}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
                          "bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Folder
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Links */}
              <div className="mt-4 bg-card border border-border rounded-lg p-3 space-y-1">
                <button
                  onClick={() => navigate('/dashboard/links')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 text-left transition-colors"
                >
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Manage share links</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground ml-auto" />
                </button>
                <button
                  onClick={() => navigate('/dashboard/analytics')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 text-left transition-colors"
                >
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">View analytics</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground ml-auto" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Dashboard;

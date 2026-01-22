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
  Upload,
  Plus,
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

interface RecentFolder {
  id: string;
  name: string;
  file_count?: number;
}

const Dashboard = () => {
  const { user, profile, subscription, daysRemaining } = useAuth();
  const navigate = useNavigate();
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [recentFolders, setRecentFolders] = useState<RecentFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        const [metricsRes, foldersRes] = await Promise.all([
          supabase
            .from("usage_metrics")
            .select("*")
            .eq("user_id", user.id)
            .single(),
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

          {/* Folders & Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Folder Shortcuts */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <div className="bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium text-foreground">My Folders</h2>
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

                <div className="p-4">
                  {loading ? (
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-8 w-24 rounded-full" />
                      <Skeleton className="h-8 w-20 rounded-full" />
                      <Skeleton className="h-8 w-28 rounded-full" />
                    </div>
                  ) : recentFolders.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2">
                        <FolderOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">No folders yet</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/dashboard/files')}
                      >
                        Create folder
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Quick Links */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <div className="bg-card border border-border rounded-lg p-3 space-y-1">
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

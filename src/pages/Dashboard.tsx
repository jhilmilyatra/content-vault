import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TrialBanner from "@/components/dashboard/TrialBanner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/fileService";
import { 
  HardDrive, 
  Download, 
  Link2, 
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  FolderOpen,
  FileVideo,
  FileImage,
  FileText as FileTextIcon,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UsageMetrics {
  storage_used_bytes: number;
  bandwidth_used_bytes: number;
  active_links_count: number;
  total_views: number;
  total_downloads: number;
}

interface Subscription {
  storage_limit_gb: number;
  bandwidth_limit_gb: number;
  max_active_links: number;
}

interface RecentFile {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

type QuotaType = "storage" | "bandwidth" | "links";

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith("video/")) return FileVideo;
  if (mimeType?.startsWith("image/")) return FileImage;
  return FileTextIcon;
};

const Dashboard = () => {
  const { user, profile, subscription, daysRemaining } = useAuth();
  const navigate = useNavigate();
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Fetch usage metrics
        const { data: metricsData } = await supabase
          .from("usage_metrics")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        if (metricsData) {
          setUsageMetrics(metricsData as UsageMetrics);
        }

        // Fetch recent files
        const { data: filesData } = await supabase
          .from("files")
          .select("id, name, mime_type, size_bytes, created_at")
          .eq("user_id", user.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (filesData) {
          setRecentFiles(filesData as RecentFile[]);
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

  const bandwidthUsedBytes = usageMetrics?.bandwidth_used_bytes || 0;
  const bandwidthLimitBytes = (subscription?.bandwidth_limit_gb || 10) * 1024 * 1024 * 1024;
  const bandwidthPercentage = Math.min((bandwidthUsedBytes / bandwidthLimitBytes) * 100, 100);

  const activeLinks = usageMetrics?.active_links_count || 0;
  const maxLinks = subscription?.max_active_links || 5;
  const activeLinksPercentage = maxLinks > 0 ? Math.min((activeLinks / maxLinks) * 100, 100) : 0;

  const STORAGE_ALERT_THRESHOLD = 80;
  const BANDWIDTH_ALERT_THRESHOLD = 80;
  const ACTIVE_LINKS_ALERT_THRESHOLD = 80;

  const isNearStorageLimit = storagePercentage >= STORAGE_ALERT_THRESHOLD;
  const isNearBandwidthLimit = bandwidthPercentage >= BANDWIDTH_ALERT_THRESHOLD;
  const isNearActiveLinksLimit =
    maxLinks > 0 && activeLinksPercentage >= ACTIVE_LINKS_ALERT_THRESHOLD;

  const quotaAlerts: { type: QuotaType; percentage: number }[] = [];

  if (isNearStorageLimit) {
    quotaAlerts.push({ type: "storage", percentage: storagePercentage });
  }

  if (isNearBandwidthLimit) {
    quotaAlerts.push({ type: "bandwidth", percentage: bandwidthPercentage });
  }

  if (isNearActiveLinksLimit) {
    quotaAlerts.push({ type: "links", percentage: activeLinksPercentage });
  }

  const stats = [
    {
      label: "Storage Used",
      value: formatFileSize(storageUsedBytes),
      limit: `/ ${subscription?.storage_limit_gb || 1} GB`,
      percentage: storagePercentage,
      icon: HardDrive,
      color: "from-primary to-cyan-400"
    },
    {
      label: "Bandwidth",
      value: formatFileSize(bandwidthUsedBytes),
      limit: `/ ${subscription?.bandwidth_limit_gb || 10} GB`,
      percentage: bandwidthPercentage,
      icon: Download,
      color: "from-violet-500 to-purple-400"
    },
    {
      label: "Active Links",
      value: String(activeLinks),
      limit: `/ ${maxLinks}`,
      percentage: activeLinksPercentage,
      icon: Link2,
      color: "from-amber-500 to-orange-400"
    },
    {
      label: "Total Views",
      value: String(usageMetrics?.total_views || 0),
      limit: "",
      percentage: 0,
      icon: Users,
      color: "from-emerald-500 to-teal-400"
    },
  ];
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Trial Banner */}
        <TrialBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 
              {subscription?.plan === 'free' && daysRemaining !== null && (
                <span className="ml-2 text-amber-500">
                  ({daysRemaining} days left in trial)
                </span>
              )}
            </p>
          </div>
          <Button variant="hero" onClick={() => navigate('/dashboard/files')}>
            Upload Files
          </Button>
        </div>

        {/* Quota alerts */}
        {isNearStorageLimit && (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Storage nearly full</AlertTitle>
              <AlertDescription>
                You&apos;ve used {Math.round(storagePercentage)}% of your{" "}
                {subscription?.storage_limit_gb || 1} GB storage limit. New uploads may fail
                soon. Consider deleting unused files or{" "}
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/plans")}
                  className="underline font-medium"
                >
                  upgrading your plan
                </button>
                .
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} p-2.5`}>
                  <stat.icon className="w-full h-full text-white" />
                </div>
                {stat.percentage > 0 && (
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
                    ${stat.percentage > 80 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}
                  `}>
                    {stat.percentage > 80 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {Math.round(stat.percentage)}%
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                  {stat.limit && <span className="text-sm text-muted-foreground">{stat.limit}</span>}
                </div>
              </div>
              {stat.percentage > 0 && (
                <div className="mt-3">
                  <Progress value={stat.percentage} className="h-1.5" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Files */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="lg:col-span-2 p-6 rounded-xl bg-card border border-border"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Recent Files</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/files')}>
                View All
              </Button>
            </div>

            {recentFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentFiles.map((file, index) => {
                  const Icon = getFileIcon(file.mime_type);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size_bytes)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Quick Actions & Storage */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="p-6 rounded-xl bg-card border border-border"
          >
            <h2 className="text-lg font-semibold text-foreground mb-6">Quick Actions</h2>
            
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/dashboard/files')}>
                <FolderOpen className="w-5 h-5 text-primary" />
                Manage Files
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/dashboard/links')}>
                <Link2 className="w-5 h-5 text-primary" />
                Manage Share Links
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => navigate('/dashboard/analytics')}>
                <TrendingUp className="w-5 h-5 text-primary" />
                View Analytics
              </Button>
            </div>

            {/* Storage indicator */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium text-foreground">
                  {formatFileSize(storageUsedBytes)} / {subscription?.storage_limit_gb || 1} GB
                </span>
              </div>
              <Progress value={storagePercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(storagePercentage)}% of storage used
              </p>
              {storagePercentage > 80 && (
                <p className="text-xs text-amber-500 mt-1">
                  Running low on storage. Consider upgrading your plan.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;

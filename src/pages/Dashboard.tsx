import { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardPreloader from "@/components/dashboard/DashboardPreloader";
import TrialBanner from "@/components/dashboard/TrialBanner";
import TelegramUploadTracker from "@/components/dashboard/TelegramUploadTracker";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios/GlassCard";
import { SkeletonStats, SkeletonList } from "@/components/ios/SkeletonLoader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatFileSize } from "@/lib/fileService";
import { lightHaptic } from "@/lib/haptics";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { 
  HardDrive, 
  Download, 
  Link2, 
  Eye,
  TrendingUp,
  FolderOpen,
  FileVideo,
  FileImage,
  FileText as FileTextIcon,
  Sparkles,
  ChevronRight,
  Activity,
  BarChart3,
  Crown
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith("video/")) return FileVideo;
  if (mimeType?.startsWith("image/")) return FileImage;
  return FileTextIcon;
};

// Premium animation variants with proper typing
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24
    }
  }
};

const Dashboard = () => {
  const { user, profile, subscription, daysRemaining } = useAuth();
  const navigate = useNavigate();
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreloader, setShowPreloader] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        const { data: metricsData } = await supabase
          .from("usage_metrics")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        if (metricsData) {
          setUsageMetrics(metricsData as UsageMetrics);
        }

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

  const quickActions = [
    { label: "Manage Files", icon: FolderOpen, route: "/dashboard/files", color: "from-primary to-amber-400" },
    { label: "Share Links", icon: Link2, route: "/dashboard/links", color: "from-emerald-500 to-teal-400" },
    { label: "Analytics", icon: BarChart3, route: "/dashboard/analytics", color: "from-violet-500 to-purple-400" },
  ];
  
  return (
    <>
      <DashboardPreloader 
        onComplete={() => setShowPreloader(false)} 
        duration={1500} 
      />
      <DashboardLayout>
        <PageTransition>
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Trial Banner */}
            <TrialBanner />

            {/* Luxury Header */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-3xl ios-glass-elevated p-6 sm:p-8"
            >
              {/* Background gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-60" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/20 to-transparent blur-3xl" />
              
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <motion.div 
                    className="flex items-center gap-3 mb-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/30">
                      <Sparkles className="w-6 h-6 text-background" />
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight">
                        Welcome back
                        {profile?.full_name && (
                          <span className="bg-gradient-to-r from-primary via-amber-400 to-primary bg-clip-text text-transparent">
                            , {profile.full_name.split(' ')[0]}
                          </span>
                        )}
                      </h1>
                    </div>
                  </motion.div>
                  <motion.p 
                    className="text-muted-foreground text-sm sm:text-base max-w-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    {subscription?.plan === 'free' && daysRemaining !== null ? (
                      <>Your journey begins here. <span className="text-primary font-medium">{daysRemaining} days</span> remaining in your trial.</>
                    ) : subscription?.plan === 'premium' ? (
                      <span className="flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-primary" />
                        Premium member — unlimited possibilities await
                      </span>
                    ) : (
                      "Your secure cloud storage dashboard"
                    )}
                  </motion.p>
                </div>
                
                <motion.button
                  onClick={() => {
                    lightHaptic();
                    navigate('/dashboard/files');
                  }}
                  className="ios-button-primary px-6 py-3 rounded-xl flex items-center gap-2 font-medium"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <TrendingUp className="w-4 h-4" />
                  Upload Files
                </motion.button>
              </div>
            </motion.div>

            {/* Stats Grid */}
            {loading ? (
              <SkeletonStats count={4} />
            ) : (
              <motion.div 
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={itemVariants}>
                  <StatCard
                    title="Storage"
                    value={formatFileSize(storageUsedBytes)}
                    icon={<HardDrive className="w-5 h-5 text-primary" />}
                    trend={storagePercentage > 80 ? "up" : "neutral"}
                    trendValue={`${Math.round(storagePercentage)}% used`}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <StatCard
                    title="Bandwidth"
                    value={formatFileSize(bandwidthUsedBytes)}
                    icon={<Download className="w-5 h-5 text-violet-400" />}
                    trend={bandwidthPercentage > 80 ? "up" : "neutral"}
                    trendValue={`${Math.round(bandwidthPercentage)}% used`}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <StatCard
                    title="Active Links"
                    value={String(activeLinks)}
                    icon={<Link2 className="w-5 h-5 text-amber-400" />}
                    trend="neutral"
                    trendValue={`of ${maxLinks} links`}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <StatCard
                    title="Total Views"
                    value={String(usageMetrics?.total_views || 0)}
                    icon={<Eye className="w-5 h-5 text-emerald-400" />}
                    trend="up"
                    trendValue={`${usageMetrics?.total_downloads || 0} downloads`}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Telegram Upload Tracker */}
            <TelegramUploadTracker />

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Files */}
              <motion.div
                className="lg:col-span-2"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <GlassCard variant="elevated">
                  <GlassCardHeader 
                    title="Recent Files" 
                    icon={<Activity className="w-5 h-5 text-primary" />}
                    action={
                      <motion.button
                        onClick={() => {
                          lightHaptic();
                          navigate('/dashboard/files');
                        }}
                        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        View All
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    }
                  />

                  {loading ? (
                    <SkeletonList count={5} />
                  ) : recentFiles.length === 0 ? (
                    <motion.div 
                      className="text-center py-12"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-4">No files uploaded yet</p>
                      <motion.button
                        onClick={() => {
                          lightHaptic();
                          navigate('/dashboard/files');
                        }}
                        className="ios-button-secondary px-4 py-2 rounded-xl text-sm"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Upload your first file
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="space-y-2"
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                    >
                      <AnimatePresence>
                        {recentFiles.map((file, index) => {
                          const Icon = getFileIcon(file.mime_type);
                          return (
                            <motion.div
                              key={file.id}
                              variants={itemVariants}
                              className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group cursor-pointer ios-press"
                              onClick={() => lightHaptic()}
                              whileHover={{ x: 4 }}
                            >
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-white/[0.05]">
                                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size_bytes)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(file.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </GlassCard>
              </motion.div>

              {/* Quick Actions & Storage */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <GlassCard variant="elevated">
                  <GlassCardHeader title="Quick Actions" />
                  
                  <motion.div 
                    className="space-y-3 mb-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {quickActions.map((action, index) => (
                      <motion.button
                        key={action.label}
                        variants={itemVariants}
                        onClick={() => {
                          lightHaptic();
                          navigate(action.route);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl ios-glass-subtle hover:bg-white/[0.06] transition-all group ios-press"
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                          <action.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </motion.div>

                  {/* Storage Indicator */}
                  <div className="pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="font-medium text-foreground">
                        {formatFileSize(storageUsedBytes)} / {subscription?.storage_limit_gb || 1} GB
                      </span>
                    </div>
                    <div className="relative">
                      <Progress value={storagePercentage} className="h-2" />
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-full"
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: storagePercentage / 100 }}
                        transition={{ delay: 0.8, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {Math.round(storagePercentage)}% of storage used
                    </p>
                    {storagePercentage > 80 && (
                      <motion.p 
                        className="text-xs text-amber-400 mt-2 flex items-center gap-1"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                      >
                        <Sparkles className="w-3 h-3" />
                        Running low on storage. Consider upgrading.
                      </motion.p>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </motion.div>
        </PageTransition>
      </DashboardLayout>
    </>
  );
};

export default Dashboard;

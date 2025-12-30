import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  HardDrive,
  Download,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios/GlassCard";
import { SkeletonStats } from "@/components/ios/SkeletonLoader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import VpsHealthWidget from "@/components/owner/VpsHealthWidget";

interface GlobalStats {
  totalUsers: number;
  totalStorage: number;
  totalBandwidth: number;
  activeLinks: number;
  premiumUsers: number;
  totalDownloads: number;
}

const OwnerDashboard = () => {
  const [stats, setStats] = useState<GlobalStats>({
    totalUsers: 0,
    totalStorage: 0,
    totalBandwidth: 0,
    activeLinks: 0,
    premiumUsers: 0,
    totalDownloads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const fetchGlobalStats = async () => {
    try {
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan");

      const premiumCount = subscriptions?.filter(
        (s) => s.plan === "premium" || s.plan === "lifetime"
      ).length || 0;

      const { data: metrics } = await supabase
        .from("usage_metrics")
        .select("storage_used_bytes, bandwidth_used_bytes, active_links_count, total_downloads");

      const totalStorage = metrics?.reduce((acc, m) => acc + Number(m.storage_used_bytes), 0) || 0;
      const totalBandwidth = metrics?.reduce((acc, m) => acc + Number(m.bandwidth_used_bytes), 0) || 0;
      const activeLinks = metrics?.reduce((acc, m) => acc + m.active_links_count, 0) || 0;
      const totalDownloads = metrics?.reduce((acc, m) => acc + m.total_downloads, 0) || 0;

      setStats({
        totalUsers: userCount || 0,
        totalStorage,
        totalBandwidth,
        activeLinks,
        premiumUsers: premiumCount,
        totalDownloads,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toString(),
      icon: Users,
    },
    {
      label: "Premium Users",
      value: stats.premiumUsers.toString(),
      icon: DollarSign,
    },
    {
      label: "Total Storage",
      value: formatBytes(stats.totalStorage),
      icon: HardDrive,
    },
    {
      label: "Bandwidth Used",
      value: formatBytes(stats.totalBandwidth),
      icon: Download,
    },
    {
      label: "Active Links",
      value: stats.activeLinks.toString(),
      icon: Activity,
    },
    {
      label: "Total Downloads",
      value: stats.totalDownloads.toLocaleString(),
      icon: TrendingUp,
    },
  ];

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6 px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            Owner Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 ml-13 text-sm">
            Global overview and infrastructure management
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <SkeletonStats />
        ) : (
          <motion.div 
            className="grid grid-cols-2 gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {statCards.map((stat, index) => (
              <motion.div key={stat.label} variants={staggerItem}>
                <StatCard
                  title={stat.label}
                  value={stat.value}
                  icon={<stat.icon className="w-5 h-5" />}
                  className="animate-fade-up"
                  style={{ animationDelay: `${0.05 + index * 0.05}s` }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* VPS Health & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* VPS Health Widget */}
          <VpsHealthWidget />

          {/* System Alerts */}
          <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <GlassCardHeader
              title="System Alerts"
              icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            />
            <div className="p-4 space-y-3">
              <motion.div 
                className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse-glow" />
                <span className="text-sm text-foreground">
                  3 users approaching storage limit
                </span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-foreground">
                  All systems operational
                </span>
              </motion.div>
            </div>
          </GlassCard>
        </div>

        {/* Recent Activity */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <GlassCardHeader title="Recent Activity" />
          <div className="p-4 space-y-3">
            <motion.div 
              className="flex items-center gap-4 p-4 rounded-2xl ios-glass-subtle"
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                JD
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  New user registered
                </p>
                <p className="text-xs text-muted-foreground">2 minutes ago</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
            <motion.div 
              className="flex items-center gap-4 p-4 rounded-2xl ios-glass-subtle"
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/10 flex items-center justify-center text-amber-400 text-sm font-semibold">
                $
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Premium upgrade
                </p>
                <p className="text-xs text-muted-foreground">15 minutes ago</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>
    </DashboardLayout>
  );
};

export default OwnerDashboard;

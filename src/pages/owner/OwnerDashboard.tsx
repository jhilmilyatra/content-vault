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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/PageTransition";

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
      color: "from-teal-500 to-cyan-400",
      change: "+12%",
    },
    {
      label: "Premium Users",
      value: stats.premiumUsers.toString(),
      icon: DollarSign,
      color: "from-amber-500 to-orange-400",
      change: "+8%",
    },
    {
      label: "Total Storage",
      value: formatBytes(stats.totalStorage),
      icon: HardDrive,
      color: "from-violet-500 to-purple-400",
      change: "+24 GB",
    },
    {
      label: "Bandwidth Used",
      value: formatBytes(stats.totalBandwidth),
      icon: Download,
      color: "from-emerald-500 to-teal-400",
      change: "+156 GB",
    },
    {
      label: "Active Links",
      value: stats.activeLinks.toString(),
      icon: Activity,
      color: "from-rose-500 to-pink-400",
      change: "+34",
    },
    {
      label: "Total Downloads",
      value: stats.totalDownloads.toLocaleString(),
      icon: TrendingUp,
      color: "from-blue-500 to-indigo-400",
      change: "+2.4K",
    },
  ];

  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10";

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <Shield className="w-6 h-6 text-amber-400" />
                Owner Dashboard
              </h1>
              <p className="text-white/50">
                Global overview and infrastructure management
              </p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <Card className={`${glassCard} hover:border-white/20 transition-all duration-300`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} p-3 shadow-lg`}
                      >
                        <stat.icon className="w-full h-full text-white" />
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ArrowUpRight className="w-3 h-3" />
                        {stat.change}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-white/50">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">
                        {loading ? "..." : stat.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className={glassCard}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    System Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" />
                      <span className="text-sm text-white/80">
                        3 users approaching storage limit
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                      <span className="text-sm text-white/80">
                        All systems operational
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className={glassCard}>
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                        JD
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          New user registered
                        </p>
                        <p className="text-xs text-white/40">2 minutes ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs font-semibold">
                        $
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">
                          Premium upgrade
                        </p>
                        <p className="text-xs text-white/40">15 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default OwnerDashboard;
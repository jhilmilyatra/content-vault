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
      // Fetch profiles count
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch subscriptions stats
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan");

      const premiumCount = subscriptions?.filter(
        (s) => s.plan === "premium" || s.plan === "lifetime"
      ).length || 0;

      // Fetch usage metrics
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
      color: "from-primary to-cyan-400",
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-500" />
              Owner Dashboard
            </h1>
            <p className="text-muted-foreground">
              Global overview and infrastructure management
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="hover:border-primary/30 transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} p-3`}
                    >
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                      <ArrowUpRight className="w-3 h-3" />
                      {stat.change}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-foreground">
                    3 users approaching storage limit
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-foreground">
                    All systems operational
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                    JD
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      New user registered
                    </p>
                    <p className="text-xs text-muted-foreground">2 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-semibold">
                    $
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Premium upgrade
                    </p>
                    <p className="text-xs text-muted-foreground">15 minutes ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OwnerDashboard;

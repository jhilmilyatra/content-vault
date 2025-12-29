import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Users,
  AlertTriangle,
  FileWarning,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard, SkeletonStats } from "@/components/ios";

interface AdminStats {
  totalUsers: number;
  suspendedUsers: number;
  pendingReports: number;
  resolvedReports: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    suspendedUsers: 0,
    pendingReports: 0,
    resolvedReports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      // Fetch user counts
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: suspendedUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_suspended", true);

      // Fetch report counts
      const { count: pendingReports } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "reviewing"]);

      const { count: resolvedReports } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved");

      setStats({
        totalUsers: totalUsers || 0,
        suspendedUsers: suspendedUsers || 0,
        pendingReports: pendingReports || 0,
        resolvedReports: resolvedReports || 0,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "from-primary to-cyan-400",
    },
    {
      label: "Suspended Users",
      value: stats.suspendedUsers,
      icon: AlertTriangle,
      color: "from-destructive to-rose-400",
    },
    {
      label: "Pending Reports",
      value: stats.pendingReports,
      icon: Clock,
      color: "from-amber-500 to-orange-400",
    },
    {
      label: "Resolved Reports",
      value: stats.resolvedReports,
      icon: CheckCircle,
      color: "from-emerald-500 to-teal-400",
    },
  ];

  return (
    <DashboardLayout>
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            Admin Dashboard
          </h1>
          <p className="text-white/50 mt-1">
            Moderation overview and quick actions
          </p>
        </motion.div>

        {/* Stats Grid */}
        {loading ? (
          <SkeletonStats count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
              >
                <GlassCard className="ios-card-hover">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} p-3 shadow-lg`}
                    >
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                  </div>
                  <p className="text-sm text-white/50 font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard variant="elevated">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/20">
                  <FileWarning className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Recent Reports</h3>
              </div>
              {stats.pendingReports === 0 ? (
                <p className="text-white/50 text-center py-4">
                  No pending reports
                </p>
              ) : (
                <p className="text-white/70">
                  You have <span className="text-amber-400 font-semibold">{stats.pendingReports}</span> report(s) requiring attention.
                </p>
              )}
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard variant="elevated">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/20">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Activity Summary</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl ios-glass">
                  <span className="text-sm text-white/70">Active users today</span>
                  <span className="font-semibold text-white">-</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl ios-glass">
                  <span className="text-sm text-white/70">New signups (7d)</span>
                  <span className="font-semibold text-white">-</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default AdminDashboard;

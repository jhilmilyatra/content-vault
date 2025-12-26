import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-500" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Moderation overview and quick actions
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <Card className="hover:border-primary/30 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} p-3`}
                    >
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {loading ? "..." : stat.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-amber-500" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.pendingReports === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No pending reports
                </p>
              ) : (
                <p className="text-muted-foreground">
                  You have {stats.pendingReports} report(s) requiring attention.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-foreground">Active users today</span>
                  <span className="font-medium text-foreground">-</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-foreground">New signups (7d)</span>
                  <span className="font-medium text-foreground">-</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;

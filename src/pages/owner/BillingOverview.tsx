import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  HardDrive,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BillingStats {
  totalRevenue: number;
  freeUsers: number;
  premiumUsers: number;
  lifetimeUsers: number;
  totalStorageCost: number;
  totalBandwidthCost: number;
}

const BillingOverview = () => {
  const [stats, setStats] = useState<BillingStats>({
    totalRevenue: 0,
    freeUsers: 0,
    premiumUsers: 0,
    lifetimeUsers: 0,
    totalStorageCost: 0,
    totalBandwidthCost: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingStats();
  }, []);

  const fetchBillingStats = async () => {
    try {
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan");

      const { data: metrics } = await supabase
        .from("usage_metrics")
        .select("storage_used_bytes, bandwidth_used_bytes");

      const freeUsers = subscriptions?.filter((s) => s.plan === "free").length || 0;
      const premiumUsers = subscriptions?.filter((s) => s.plan === "premium").length || 0;
      const lifetimeUsers = subscriptions?.filter((s) => s.plan === "lifetime").length || 0;

      // Calculate costs (example rates: $0.02/GB storage, $0.01/GB bandwidth)
      const totalStorage = metrics?.reduce((acc, m) => acc + Number(m.storage_used_bytes), 0) || 0;
      const totalBandwidth = metrics?.reduce((acc, m) => acc + Number(m.bandwidth_used_bytes), 0) || 0;

      const storageGB = totalStorage / (1024 * 1024 * 1024);
      const bandwidthGB = totalBandwidth / (1024 * 1024 * 1024);

      setStats({
        totalRevenue: premiumUsers * 9.99 + lifetimeUsers * 99,
        freeUsers,
        premiumUsers,
        lifetimeUsers,
        totalStorageCost: storageGB * 0.02,
        totalBandwidthCost: bandwidthGB * 0.01,
      });
    } catch (error) {
      console.error("Error fetching billing stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const planDistribution = [
    { label: "Free", count: stats.freeUsers, color: "bg-muted" },
    { label: "Premium", count: stats.premiumUsers, color: "bg-violet-500" },
    { label: "Lifetime", count: stats.lifetimeUsers, color: "bg-amber-500" },
  ];

  const totalUsers = stats.freeUsers + stats.premiumUsers + stats.lifetimeUsers;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Billing Overview
            </h1>
            <p className="text-muted-foreground">
              Revenue, costs, and subscription analytics
            </p>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 p-3">
                    <DollarSign className="w-full h-full text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                    <ArrowUpRight className="w-3 h-3" />
                    +12%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  ${loading ? "..." : stats.totalRevenue.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 p-3">
                    <Users className="w-full h-full text-white" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Paid Users</p>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? "..." : stats.premiumUsers + stats.lifetimeUsers}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-400 p-3">
                    <HardDrive className="w-full h-full text-white" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Storage Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  ${loading ? "..." : stats.totalStorageCost.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-400 p-3">
                    <Download className="w-full h-full text-white" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Bandwidth Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  ${loading ? "..." : stats.totalBandwidthCost.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Subscription Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {planDistribution.map((plan) => (
              <div key={plan.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{plan.label}</span>
                  <span className="text-muted-foreground">
                    {plan.count} users ({totalUsers > 0 ? ((plan.count / totalUsers) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <Progress
                  value={totalUsers > 0 ? (plan.count / totalUsers) * 100 : 0}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Profit Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Profit Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-medium text-foreground">
                  ${stats.totalRevenue.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Infrastructure Costs</span>
                <span className="font-medium text-destructive">
                  -${(stats.totalStorageCost + stats.totalBandwidthCost).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-semibold text-foreground">Net Profit</span>
                <span className="font-bold text-lg text-success">
                  ${(stats.totalRevenue - stats.totalStorageCost - stats.totalBandwidthCost).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BillingOverview;

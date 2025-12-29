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
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios/GlassCard";
import { SkeletonStats, SkeletonList } from "@/components/ios/SkeletonLoader";
import { staggerContainer, staggerItem } from "@/lib/motion";

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
    { label: "Free", count: stats.freeUsers, color: "bg-muted-foreground/40" },
    { label: "Premium", count: stats.premiumUsers, color: "bg-primary" },
    { label: "Lifetime", count: stats.lifetimeUsers, color: "bg-amber-500" },
  ];

  const totalUsers = stats.freeUsers + stats.premiumUsers + stats.lifetimeUsers;

  const statCards = [
    {
      label: "Monthly Revenue",
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
    },
    {
      label: "Paid Users",
      value: (stats.premiumUsers + stats.lifetimeUsers).toString(),
      icon: Users,
    },
    {
      label: "Storage Cost",
      value: `$${stats.totalStorageCost.toFixed(2)}`,
      icon: HardDrive,
    },
    {
      label: "Bandwidth Cost",
      value: `$${stats.totalBandwidthCost.toFixed(2)}`,
      icon: Download,
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            Billing Overview
          </h1>
          <p className="text-muted-foreground mt-1 ml-13 text-sm">
            Revenue, costs, and subscription analytics
          </p>
        </div>

        {/* Revenue Stats */}
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

        {/* Plan Distribution */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <GlassCardHeader
            title="Subscription Distribution"
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
          />
          <div className="p-4 space-y-5">
            {loading ? (
              <SkeletonList />
            ) : (
              planDistribution.map((plan, index) => (
                <motion.div 
                  key={plan.label} 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{plan.label}</span>
                    <span className="text-muted-foreground">
                      {plan.count} users ({totalUsers > 0 ? ((plan.count / totalUsers) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full ${plan.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${totalUsers > 0 ? (plan.count / totalUsers) * 100 : 0}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Profit Summary */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <GlassCardHeader title="Profit Summary" />
          <div className="p-4 space-y-1">
            <motion.div 
              className="flex items-center justify-between py-4 border-b border-border/30"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-semibold text-foreground">
                ${stats.totalRevenue.toFixed(2)}
              </span>
            </motion.div>
            <motion.div 
              className="flex items-center justify-between py-4 border-b border-border/30"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-muted-foreground">Infrastructure Costs</span>
              <span className="font-semibold text-destructive">
                -${(stats.totalStorageCost + stats.totalBandwidthCost).toFixed(2)}
              </span>
            </motion.div>
            <motion.div 
              className="flex items-center justify-between py-4"
              whileTap={{ scale: 0.98 }}
            >
              <span className="font-semibold text-foreground">Net Profit</span>
              <span className="font-bold text-lg text-emerald-400">
                ${(stats.totalRevenue - stats.totalStorageCost - stats.totalBandwidthCost).toFixed(2)}
              </span>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>
    </DashboardLayout>
  );
};

export default BillingOverview;

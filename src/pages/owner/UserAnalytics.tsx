import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Users,
  HardDrive,
  Download,
  Link2,
  Eye,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios";
import { SkeletonStats, SkeletonTable } from "@/components/ios";
import { lightHaptic } from "@/lib/haptics";

interface UserMetrics {
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan: string;
  storage_used_bytes: number;
  storage_limit_gb: number;
  bandwidth_used_bytes: number;
  bandwidth_limit_gb: number;
  total_downloads: number;
  total_views: number;
  active_links_count: number;
}

interface PlatformStats {
  totalUsers: number;
  totalStorage: number;
  totalBandwidth: number;
  totalDownloads: number;
  totalViews: number;
  totalLinks: number;
  planDistribution: { name: string; value: number; color: string }[];
}

const COLORS = ["#14b8a6", "#a855f7", "#f59e0b"];

const UserAnalytics = () => {
  const [userMetrics, setUserMetrics] = useState<UserMetrics[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalStorage: 0,
    totalBandwidth: 0,
    totalDownloads: 0,
    totalViews: 0,
    totalLinks: 0,
    planDistribution: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"storage" | "bandwidth" | "downloads">("storage");

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: profiles } = await supabase.from("profiles").select("user_id, email, full_name");
      const { data: subscriptions } = await supabase.from("subscriptions").select("*");
      const { data: metrics } = await supabase.from("usage_metrics").select("*");

      const combined: UserMetrics[] = (profiles || []).map((profile) => {
        const sub = subscriptions?.find((s) => s.user_id === profile.user_id);
        const usage = metrics?.find((m) => m.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          plan: sub?.plan || "free",
          storage_used_bytes: Number(usage?.storage_used_bytes || 0),
          storage_limit_gb: sub?.storage_limit_gb || 1,
          bandwidth_used_bytes: Number(usage?.bandwidth_used_bytes || 0),
          bandwidth_limit_gb: sub?.bandwidth_limit_gb || 10,
          total_downloads: usage?.total_downloads || 0,
          total_views: usage?.total_views || 0,
          active_links_count: usage?.active_links_count || 0,
        };
      });

      setUserMetrics(combined);

      const freePlans = combined.filter((u) => u.plan === "free").length;
      const premiumPlans = combined.filter((u) => u.plan === "premium").length;
      const lifetimePlans = combined.filter((u) => u.plan === "lifetime").length;

      setPlatformStats({
        totalUsers: combined.length,
        totalStorage: combined.reduce((acc, u) => acc + u.storage_used_bytes, 0),
        totalBandwidth: combined.reduce((acc, u) => acc + u.bandwidth_used_bytes, 0),
        totalDownloads: combined.reduce((acc, u) => acc + u.total_downloads, 0),
        totalViews: combined.reduce((acc, u) => acc + u.total_views, 0),
        totalLinks: combined.reduce((acc, u) => acc + u.active_links_count, 0),
        planDistribution: [
          { name: "Free", value: freePlans, color: COLORS[0] },
          { name: "Premium", value: premiumPlans, color: COLORS[1] },
          { name: "Lifetime", value: lifetimePlans, color: COLORS[2] },
        ],
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
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

  const getStoragePercentage = (used: number, limitGb: number) => {
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    return Math.min((used / limitBytes) * 100, 100);
  };

  const filteredUsers = userMetrics
    .filter((u) => u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "storage") return b.storage_used_bytes - a.storage_used_bytes;
      if (sortBy === "bandwidth") return b.bandwidth_used_bytes - a.bandwidth_used_bytes;
      return b.total_downloads - a.total_downloads;
    });

  const topUsersChartData = filteredUsers.slice(0, 10).map((u) => ({
    name: u.full_name || u.email?.split("@")[0] || "User",
    storage: Math.round(u.storage_used_bytes / (1024 * 1024)),
    bandwidth: Math.round(u.bandwidth_used_bytes / (1024 * 1024)),
  }));

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "lifetime": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Lifetime</Badge>;
      case "premium": return <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">Premium</Badge>;
      default: return <Badge variant="outline" className="border-white/20 text-white/70">Free</Badge>;
    }
  };

  const handleCycleSort = () => {
    lightHaptic();
    setSortBy((prev) => prev === "storage" ? "bandwidth" : prev === "bandwidth" ? "downloads" : "storage");
  };

  const statCards = [
    { label: "Total Users", value: platformStats.totalUsers, icon: Users, gradient: "from-teal-500 to-cyan-400" },
    { label: "Total Storage", value: formatBytes(platformStats.totalStorage), icon: HardDrive, gradient: "from-violet-500 to-purple-400" },
    { label: "Total Bandwidth", value: formatBytes(platformStats.totalBandwidth), icon: Download, gradient: "from-amber-500 to-orange-400" },
    { label: "Downloads", value: platformStats.totalDownloads.toLocaleString(), icon: Download, gradient: "from-emerald-500 to-teal-400" },
    { label: "Views", value: platformStats.totalViews.toLocaleString(), icon: Eye, gradient: "from-rose-500 to-pink-400" },
    { label: "Active Links", value: platformStats.totalLinks.toLocaleString(), icon: Link2, gradient: "from-indigo-500 to-blue-400" },
  ];

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-teal-400" />
              User Analytics
            </h1>
            <p className="text-white/50 text-sm">Detailed storage, bandwidth, and usage statistics per user</p>
          </motion.div>

          {/* Stats Grid */}
          {loading ? (
            <SkeletonStats count={6} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {statCards.map((stat, index) => (
                <motion.div 
                  key={stat.label} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.05 }}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <GlassCard className="ios-card-hover">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stat.gradient} p-2 mb-3`}>
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                    <p className="text-xs text-white/50">{stat.label}</p>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="lg:col-span-2">
              <GlassCardHeader title="Top Users by Usage (MB)" icon={<BarChart3 className="w-5 h-5 text-teal-400" />} />
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topUsersChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} width={80} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(0,0,0,0.9)", 
                        border: "1px solid rgba(255,255,255,0.1)", 
                        borderRadius: "12px",
                        backdropFilter: "blur(20px)"
                      }} 
                    />
                    <Bar dataKey="storage" fill="#14b8a6" name="Storage (MB)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard>
              <GlassCardHeader title="Plan Distribution" icon={<Users className="w-5 h-5 text-teal-400" />} />
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={platformStats.planDistribution} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5} 
                      dataKey="value"
                    >
                      {platformStats.planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(0,0,0,0.9)", 
                        border: "1px solid rgba(255,255,255,0.1)", 
                        borderRadius: "12px",
                        backdropFilter: "blur(20px)"
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {platformStats.planDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-white/50">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Users Table */}
          <GlassCard>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <GlassCardHeader title="All Users" icon={<Users className="w-5 h-5 text-teal-400" />} />
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input 
                    placeholder="Search users..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="pl-10 w-full sm:w-64 ios-input" 
                  />
                </div>
                <button 
                  onClick={handleCycleSort}
                  className="ios-button-secondary px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  {sortBy}
                </button>
              </div>
            </div>

            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="text-left p-4 text-sm font-medium text-white/50">User</th>
                      <th className="text-left p-4 text-sm font-medium text-white/50">Plan</th>
                      <th className="text-left p-4 text-sm font-medium text-white/50">Storage</th>
                      <th className="text-left p-4 text-sm font-medium text-white/50">Bandwidth</th>
                      <th className="text-center p-4 text-sm font-medium text-white/50">Downloads</th>
                      <th className="text-center p-4 text-sm font-medium text-white/50">Views</th>
                      <th className="text-center p-4 text-sm font-medium text-white/50">Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-white/50">No users found</td></tr>
                    ) : (
                      filteredUsers.map((user, index) => (
                        <motion.tr 
                          key={user.user_id} 
                          className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(index * 0.02, 0.3) }}
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-white">{user.full_name || "No name"}</p>
                              <p className="text-xs text-white/50">{user.email}</p>
                            </div>
                          </td>
                          <td className="p-4">{getPlanBadge(user.plan)}</td>
                          <td className="p-4">
                            <div className="w-32">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white">{formatBytes(user.storage_used_bytes)}</span>
                                <span className="text-white/50">{user.storage_limit_gb}GB</span>
                              </div>
                              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${getStoragePercentage(user.storage_used_bytes, user.storage_limit_gb)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="w-32">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white">{formatBytes(user.bandwidth_used_bytes)}</span>
                                <span className="text-white/50">{user.bandwidth_limit_gb}GB</span>
                              </div>
                              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${getStoragePercentage(user.bandwidth_used_bytes, user.bandwidth_limit_gb)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="text-center p-4 text-white">{user.total_downloads}</td>
                          <td className="text-center p-4 text-white">{user.total_views}</td>
                          <td className="text-center p-4 text-white">{user.active_links_count}</td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default UserAnalytics;
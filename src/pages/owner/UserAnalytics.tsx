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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10";

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-teal-400" />
              User Analytics
            </h1>
            <p className="text-white/50">Detailed storage, bandwidth, and usage statistics per user</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Users", value: platformStats.totalUsers, icon: Users, color: "from-teal-500 to-cyan-400" },
              { label: "Total Storage", value: formatBytes(platformStats.totalStorage), icon: HardDrive, color: "from-violet-500 to-purple-400" },
              { label: "Total Bandwidth", value: formatBytes(platformStats.totalBandwidth), icon: Download, color: "from-amber-500 to-orange-400" },
              { label: "Downloads", value: platformStats.totalDownloads.toLocaleString(), icon: Download, color: "from-emerald-500 to-teal-400" },
              { label: "Views", value: platformStats.totalViews.toLocaleString(), icon: Eye, color: "from-rose-500 to-pink-400" },
              { label: "Active Links", value: platformStats.totalLinks.toLocaleString(), icon: Link2, color: "from-indigo-500 to-blue-400" },
            ].map((stat, index) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className={glassCard}>
                  <CardContent className="pt-4 pb-4">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} p-2 mb-2`}>
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                    <p className="text-xs text-white/50">{stat.label}</p>
                    <p className="text-lg font-bold text-white">{loading ? "..." : stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className={`${glassCard} lg:col-span-2`}>
              <CardHeader>
                <CardTitle className="text-white">Top Users by Usage (MB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topUsersChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={12} width={80} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                      <Bar dataKey="storage" fill="#14b8a6" name="Storage (MB)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className={glassCard}>
              <CardHeader>
                <CardTitle className="text-white">Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={platformStats.planDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {platformStats.planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
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
              </CardContent>
            </Card>
          </div>

          <Card className={glassCard}>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-white">All Users</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSortBy((prev) => prev === "storage" ? "bandwidth" : prev === "bandwidth" ? "downloads" : "storage")} className="border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    Sort: {sortBy}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/50">User</TableHead>
                      <TableHead className="text-white/50">Plan</TableHead>
                      <TableHead className="text-white/50">Storage</TableHead>
                      <TableHead className="text-white/50">Bandwidth</TableHead>
                      <TableHead className="text-white/50">Downloads</TableHead>
                      <TableHead className="text-white/50">Views</TableHead>
                      <TableHead className="text-white/50">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-white/50">Loading...</TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-white/50">No users found</TableCell></TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.user_id} className="border-white/10">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{user.full_name || "No name"}</p>
                              <p className="text-xs text-white/50">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{getPlanBadge(user.plan)}</TableCell>
                          <TableCell>
                            <div className="w-32">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white">{formatBytes(user.storage_used_bytes)}</span>
                                <span className="text-white/50">{user.storage_limit_gb}GB</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${getStoragePercentage(user.storage_used_bytes, user.storage_limit_gb)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-white">{formatBytes(user.bandwidth_used_bytes)}</span>
                                <span className="text-white/50">{user.bandwidth_limit_gb}GB</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${getStoragePercentage(user.bandwidth_used_bytes, user.bandwidth_limit_gb)}%` }} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-white">{user.total_downloads}</TableCell>
                          <TableCell className="text-center text-white">{user.total_views}</TableCell>
                          <TableCell className="text-center text-white">{user.active_links_count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default UserAnalytics;
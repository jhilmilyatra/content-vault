import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  BarChart3,
  TrendingUp,
  Download,
  Eye,
  HardDrive,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AnalyticsData {
  totalDownloads: number;
  totalViews: number;
  bandwidthUsed: number;
  storageUsed: number;
}

interface ChartDataPoint {
  date: string;
  downloads: number;
  views: number;
  bandwidth: number;
}

const Analytics = () => {
  const [stats, setStats] = useState<AnalyticsData>({
    totalDownloads: 0,
    totalViews: 0,
    bandwidthUsed: 0,
    storageUsed: 0,
  });
  const [timeRange, setTimeRange] = useState("7");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, role } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAnalytics();
      fetchChartData();
    }
  }, [user, role, timeRange]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      let query = supabase.from("usage_metrics").select("*");

      if (role !== "owner") {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totals = data?.reduce(
        (acc, m) => ({
          totalDownloads: acc.totalDownloads + (m.total_downloads || 0),
          totalViews: acc.totalViews + (m.total_views || 0),
          bandwidthUsed: acc.bandwidthUsed + Number(m.bandwidth_used_bytes || 0),
          storageUsed: acc.storageUsed + Number(m.storage_used_bytes || 0),
        }),
        { totalDownloads: 0, totalViews: 0, bandwidthUsed: 0, storageUsed: 0 }
      ) || { totalDownloads: 0, totalViews: 0, bandwidthUsed: 0, storageUsed: 0 };

      setStats(totals);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    if (!user) return;

    try {
      const days = parseInt(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from("file_views")
        .select("created_at, view_type, bytes_transferred, file_id, files!inner(user_id)")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (role !== "owner") {
        query = query.eq("files.user_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching chart data:", error);
        setChartData(generateEmptyChartData(days));
        return;
      }

      const dateMap = new Map<string, { downloads: number; views: number; bandwidth: number }>();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dateMap.set(dateStr, { downloads: 0, views: 0, bandwidth: 0 });
      }

      data?.forEach((view) => {
        const date = new Date(view.created_at);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        const existing = dateMap.get(dateStr) || { downloads: 0, views: 0, bandwidth: 0 };
        
        if (view.view_type === "download") {
          existing.downloads += 1;
        } else {
          existing.views += 1;
        }
        
        existing.bandwidth += Number(view.bytes_transferred || 0) / (1024 * 1024 * 1024);
        
        dateMap.set(dateStr, existing);
      });

      const chartDataArray: ChartDataPoint[] = [];
      dateMap.forEach((value, date) => {
        chartDataArray.push({
          date,
          downloads: value.downloads,
          views: value.views,
          bandwidth: parseFloat(value.bandwidth.toFixed(3)),
        });
      });

      setChartData(chartDataArray);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData(generateEmptyChartData(parseInt(timeRange)));
    }
  };

  const generateEmptyChartData = (days: number): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        downloads: 0,
        views: 0,
        bandwidth: 0,
      });
    }
    return data;
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
      label: "Total Downloads",
      value: stats.totalDownloads.toLocaleString(),
      icon: Download,
      gradient: "from-teal-500 to-cyan-500",
      glow: "shadow-teal-500/20",
      change: "+12%",
    },
    {
      label: "Total Views",
      value: stats.totalViews.toLocaleString(),
      icon: Eye,
      gradient: "from-violet-500 to-purple-500",
      glow: "shadow-violet-500/20",
      change: "+18%",
    },
    {
      label: "Bandwidth Used",
      value: formatBytes(stats.bandwidthUsed),
      icon: TrendingUp,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/20",
      change: "+8%",
    },
    {
      label: "Storage Used",
      value: formatBytes(stats.storageUsed),
      icon: HardDrive,
      gradient: "from-emerald-500 to-teal-500",
      glow: "shadow-emerald-500/20",
      change: "+5%",
    },
  ];

  // Glass card style
  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl";

  // Custom tooltip styles
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0b0b0d]/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-xl">
          <p className="text-white/50 text-xs mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 tracking-tight">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                Analytics
              </h1>
              <p className="text-white/50 mt-1">
                {role === "owner" ? "Global platform analytics" : "Your content performance"}
              </p>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white">
                <Calendar className="w-4 h-4 mr-2 text-white/50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0b0b0d] border-white/10">
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className={`${glassCard} p-6 hover:border-white/20 transition-all duration-300 group`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} p-3 shadow-lg ${stat.glow}`}>
                    <stat.icon className="w-full h-full text-white" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {stat.change}
                  </span>
                </div>
                <p className="text-sm text-white/50">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {loading ? "..." : stat.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Downloads & Views Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={glassCard}
            >
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">Downloads & Views</h3>
              </div>
              <div className="p-6">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="downloads"
                        stroke="#14b8a6"
                        fill="url(#colorDownloads)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="views"
                        stroke="#8b5cf6"
                        fill="url(#colorViews)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            {/* Bandwidth Usage Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={glassCard}
            >
              <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">Bandwidth Usage (GB)</h3>
              </div>
              <div className="p-6">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="bandwidth"
                        fill="url(#barGradient)"
                        radius={[4, 4, 0, 0]}
                      />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={glassCard}
          >
            <div className="p-6 border-b border-white/5">
              <h3 className="text-lg font-semibold text-white">Daily Activity Trend</h3>
            </div>
            <div className="p-6">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="downloads"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ fill: "#14b8a6", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#14b8a6" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#8b5cf6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Analytics;

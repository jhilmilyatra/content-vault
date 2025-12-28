import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3,
  TrendingUp,
  Download,
  Eye,
  HardDrive,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

      // If not owner, only fetch own data
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

      // Get file views aggregated by day
      let query = supabase
        .from("file_views")
        .select("created_at, view_type, bytes_transferred, file_id, files!inner(user_id)")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      // If not owner, filter by files owned by this user
      if (role !== "owner") {
        query = query.eq("files.user_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching chart data:", error);
        // Fall back to empty chart
        setChartData(generateEmptyChartData(days));
        return;
      }

      // Aggregate data by date
      const dateMap = new Map<string, { downloads: number; views: number; bandwidth: number }>();
      
      // Initialize all dates
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dateMap.set(dateStr, { downloads: 0, views: 0, bandwidth: 0 });
      }

      // Populate with real data
      data?.forEach((view) => {
        const date = new Date(view.created_at);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        
        const existing = dateMap.get(dateStr) || { downloads: 0, views: 0, bandwidth: 0 };
        
        if (view.view_type === "download") {
          existing.downloads += 1;
        } else {
          existing.views += 1;
        }
        
        existing.bandwidth += Number(view.bytes_transferred || 0) / (1024 * 1024 * 1024); // Convert to GB
        
        dateMap.set(dateStr, existing);
      });

      // Convert to array
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
      color: "from-primary to-cyan-400",
      change: "+12%",
    },
    {
      label: "Total Views",
      value: stats.totalViews.toLocaleString(),
      icon: Eye,
      color: "from-violet-500 to-purple-400",
      change: "+18%",
    },
    {
      label: "Bandwidth Used",
      value: formatBytes(stats.bandwidthUsed),
      icon: TrendingUp,
      color: "from-amber-500 to-orange-400",
      change: "+8%",
    },
    {
      label: "Storage Used",
      value: formatBytes(stats.storageUsed),
      icon: HardDrive,
      color: "from-emerald-500 to-teal-400",
      change: "+5%",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground">
              {role === "owner" ? "Global platform analytics" : "Your content performance"}
            </p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:border-primary/30 transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} p-3`}>
                      <stat.icon className="w-full h-full text-white" />
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-success/10 text-success">
                      {stat.change}
                    </span>
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Downloads & Views Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Downloads & Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(280, 100%, 70%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(280, 100%, 70%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorDownloads)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(280, 100%, 70%)"
                      fill="url(#colorViews)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bandwidth Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Bandwidth Usage (GB)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="bandwidth"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="downloads"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(280, 100%, 70%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(280, 100%, 70%)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analytics;

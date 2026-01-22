import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios/GlassCard";
import { IosSegmentedControl } from "@/components/ios";
import { SkeletonStats, SkeletonTable } from "@/components/ios/SkeletonLoader";
import {
  BarChart3,
  TrendingUp,
  Download,
  Eye,
  HardDrive,
  Link2,
  FileVideo,
  FileImage,
  FileText,
  File,
  Clock,
} from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

interface AnalyticsData {
  totalDownloads: number;
  totalViews: number;
  bandwidthUsed: number;
  storageUsed: number;
  activeLinks: number;
}

interface ChartDataPoint {
  date: string;
  downloads: number;
  views: number;
  bandwidth: number;
}

interface TopFile {
  id: string;
  name: string;
  mime_type: string;
  views: number;
  downloads: number;
}

interface RecentActivity {
  id: string;
  file_name: string;
  view_type: string;
  created_at: string;
}

interface FileTypeDistribution {
  name: string;
  value: number;
  color: string;
}

const FILE_TYPE_COLORS = ["#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#6366f1"];

const Analytics = () => {
  const [stats, setStats] = useState<AnalyticsData>({
    totalDownloads: 0,
    totalViews: 0,
    bandwidthUsed: 0,
    storageUsed: 0,
    activeLinks: 0,
  });
  const [timeRange, setTimeRange] = useState("7");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topFiles, setTopFiles] = useState<TopFile[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [fileTypeDistribution, setFileTypeDistribution] = useState<FileTypeDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, role } = useAuth();

  const timeRangeOptions = [
    { value: "7", label: "7 Days" },
    { value: "14", label: "14 Days" },
    { value: "30", label: "30 Days" },
    { value: "90", label: "90 Days" },
  ];

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, role, timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAnalytics(),
      fetchChartData(),
      fetchTopFiles(),
      fetchRecentActivity(),
      fetchFileTypeDistribution(),
    ]);
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      // Fetch metrics
      let metricsData: any[] | null = null;
      if (role !== "owner") {
        const { data, error } = await supabase.from("usage_metrics").select("*").eq("user_id", user.id);
        if (error) throw error;
        metricsData = data;
      } else {
        const { data, error } = await supabase.from("usage_metrics").select("*");
        if (error) throw error;
        metricsData = data;
      }

      // Fetch active links count using simplified query
      let linksCount = 0;
      try {
        const baseQuery = supabase
          .from("shared_links")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        
        const result = role !== "owner" 
          ? await (baseQuery as any).eq("created_by", user.id)
          : await baseQuery;
        linksCount = result.count || 0;
      } catch {
        linksCount = 0;
      }

      const totals = metricsData?.reduce(
        (acc, m) => ({
          totalDownloads: acc.totalDownloads + (m.total_downloads || 0),
          totalViews: acc.totalViews + (m.total_views || 0),
          bandwidthUsed: acc.bandwidthUsed + Number(m.bandwidth_used_bytes || 0),
          storageUsed: acc.storageUsed + Number(m.storage_used_bytes || 0),
        }),
        { totalDownloads: 0, totalViews: 0, bandwidthUsed: 0, storageUsed: 0 }
      ) || { totalDownloads: 0, totalViews: 0, bandwidthUsed: 0, storageUsed: 0 };

      setStats({
        ...totals,
        activeLinks: linksCount,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
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

  const fetchTopFiles = async () => {
    if (!user) return;

    try {
      // Get files first
      let filesQuery = supabase
        .from("files")
        .select("id, name, mime_type, user_id")
        .eq("is_deleted", false);

      if (role !== "owner") {
        filesQuery = filesQuery.eq("user_id", user.id);
      }

      const { data: files, error: filesError } = await filesQuery;
      if (filesError) throw filesError;

      if (!files || files.length === 0) {
        setTopFiles([]);
        return;
      }

      // Get view counts from file_views
      const fileIds = files.map(f => f.id);
      const { data: views, error: viewsError } = await supabase
        .from("file_views")
        .select("file_id, view_type")
        .in("file_id", fileIds);

      if (viewsError) throw viewsError;

      // Aggregate counts
      const viewCounts: Record<string, { views: number; downloads: number }> = {};
      (views || []).forEach((v) => {
        if (!viewCounts[v.file_id]) {
          viewCounts[v.file_id] = { views: 0, downloads: 0 };
        }
        if (v.view_type === "download") {
          viewCounts[v.file_id].downloads += 1;
        } else {
          viewCounts[v.file_id].views += 1;
        }
      });

      // Combine and sort
      const filesWithCounts = files.map((f) => ({
        id: f.id,
        name: f.name,
        mime_type: f.mime_type || "",
        views: viewCounts[f.id]?.views || 0,
        downloads: viewCounts[f.id]?.downloads || 0,
      }));

      filesWithCounts.sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads));
      setTopFiles(filesWithCounts.slice(0, 5));
    } catch (error) {
      console.error("Error fetching top files:", error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      const days = parseInt(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = supabase
        .from("file_views")
        .select("id, view_type, created_at, files!inner(name, user_id)")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (role !== "owner") {
        query = query.eq("files.user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setRecentActivity(
        (data || []).map((v: any) => ({
          id: v.id,
          file_name: v.files?.name || "Unknown",
          view_type: v.view_type,
          created_at: v.created_at,
        }))
      );
    } catch (error) {
      console.error("Error fetching recent activity:", error);
    }
  };

  const fetchFileTypeDistribution = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("files")
        .select("mime_type")
        .eq("is_deleted", false);

      if (role !== "owner") {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const typeCounts: Record<string, number> = {};
      (data || []).forEach((f) => {
        const type = getFileCategory(f.mime_type || "");
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const distribution: FileTypeDistribution[] = Object.entries(typeCounts).map(([name, value], index) => ({
        name,
        value,
        color: FILE_TYPE_COLORS[index % FILE_TYPE_COLORS.length],
      }));

      setFileTypeDistribution(distribution);
    } catch (error) {
      console.error("Error fetching file type distribution:", error);
    }
  };

  const getFileCategory = (mimeType: string): string => {
    if (mimeType.startsWith("video/")) return "Videos";
    if (mimeType.startsWith("image/")) return "Images";
    if (mimeType.startsWith("audio/")) return "Audio";
    if (mimeType.includes("pdf") || mimeType.includes("document")) return "Documents";
    return "Other";
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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("video/")) return <FileVideo className="w-4 h-4 text-violet-400" />;
    if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4 text-teal-400" />;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return <FileText className="w-4 h-4 text-amber-400" />;
    return <File className="w-4 h-4 text-white/50" />;
  };

  // Custom tooltip styles
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="ios-glass rounded-xl p-3 shadow-xl">
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                {role === "owner" ? "Global platform analytics" : "Your content performance"}
              </p>
            </div>
            <IosSegmentedControl
              segments={timeRangeOptions}
              value={timeRange}
              onChange={setTimeRange}
              size="sm"
            />
          </motion.div>

          {/* Stats Grid */}
          {loading ? (
            <SkeletonStats count={5} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Downloads"
                value={stats.totalDownloads.toLocaleString()}
                icon={<Download className="w-5 h-5 text-primary" />}
                trend="up"
                trendValue="+12%"
                style={{ animationDelay: "0ms" }}
              />
              <StatCard
                title="Total Views"
                value={stats.totalViews.toLocaleString()}
                icon={<Eye className="w-5 h-5 text-violet-400" />}
                trend="up"
                trendValue="+18%"
                style={{ animationDelay: "50ms" }}
              />
              <StatCard
                title="Bandwidth"
                value={formatBytes(stats.bandwidthUsed)}
                icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
                trend="up"
                trendValue="+8%"
                style={{ animationDelay: "100ms" }}
              />
              <StatCard
                title="Storage"
                value={formatBytes(stats.storageUsed)}
                icon={<HardDrive className="w-5 h-5 text-emerald-400" />}
                trend="neutral"
                trendValue="+5%"
                style={{ animationDelay: "150ms" }}
              />
              <StatCard
                title="Active Links"
                value={stats.activeLinks.toLocaleString()}
                icon={<Link2 className="w-5 h-5 text-indigo-400" />}
                trend="neutral"
                trendValue="—"
                style={{ animationDelay: "200ms" }}
              />
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Downloads & Views Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <GlassCard>
                <GlassCardHeader title="Downloads & Views" icon={<BarChart3 className="w-5 h-5 text-primary" />} />
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                        stroke="hsl(var(--primary))"
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
              </GlassCard>
            </motion.div>

            {/* Bandwidth Usage Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlassCard>
                <GlassCardHeader title="Bandwidth Usage (GB)" icon={<TrendingUp className="w-5 h-5 text-amber-400" />} />
                <div className="h-[280px]">
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
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Charts Row 2: Top Files & File Types */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Files */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="lg:col-span-2"
            >
              <GlassCard>
                <GlassCardHeader title="Top Performing Files" icon={<Eye className="w-5 h-5 text-violet-400" />} />
                {loading ? (
                  <SkeletonTable rows={5} />
                ) : topFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No file activity yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.05]">
                          <th className="text-left p-3 text-sm font-medium text-muted-foreground">File</th>
                          <th className="text-center p-3 text-sm font-medium text-muted-foreground">Views</th>
                          <th className="text-center p-3 text-sm font-medium text-muted-foreground">Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topFiles.map((file, index) => (
                          <motion.tr
                            key={file.id}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
                                  {getFileIcon(file.mime_type)}
                                </div>
                                <span className="text-sm text-foreground truncate max-w-[200px]">{file.name}</span>
                              </div>
                            </td>
                            <td className="text-center p-3 text-sm text-foreground">{file.views}</td>
                            <td className="text-center p-3 text-sm text-foreground">{file.downloads}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </motion.div>

            {/* File Type Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <GlassCard>
                <GlassCardHeader title="File Types" icon={<File className="w-5 h-5 text-primary" />} />
                {fileTypeDistribution.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No files yet</p>
                  </div>
                ) : (
                  <>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={fileTypeDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {fileTypeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "rgba(0,0,0,0.9)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {fileTypeDistribution.map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </GlassCard>
            </motion.div>
          </div>

          {/* Recent Activity & Daily Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <GlassCard>
                <GlassCardHeader title="Recent Activity" icon={<Clock className="w-5 h-5 text-amber-400" />} />
                {loading ? (
                  <SkeletonTable rows={5} />
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            activity.view_type === "download" 
                              ? "bg-primary/20" 
                              : "bg-violet-500/20"
                          }`}>
                            {activity.view_type === "download" ? (
                              <Download className="w-4 h-4 text-primary" />
                            ) : (
                              <Eye className="w-4 h-4 text-violet-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-foreground truncate max-w-[180px]">{activity.file_name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{activity.view_type}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>

            {/* Activity Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <GlassCard>
                <GlassCardHeader title="Daily Activity Trend" icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} />
                <div className="h-[280px]">
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
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Analytics;
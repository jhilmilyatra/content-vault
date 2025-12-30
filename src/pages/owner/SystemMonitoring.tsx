import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Server,
  Database,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  BarChart3,
  Play,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios";
import { SkeletonStats, SkeletonCard } from "@/components/ios";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface VpsHealthDetails {
  endpoint: string;
  status: string;
  latency?: number;
  diskUsage?: number;
  error?: string;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "critical";
  checks: {
    database: HealthCheck;
    storage: HealthCheck;
    edgeFunctions: HealthCheck;
    backgroundJobs: HealthCheck;
  };
  alerts: Alert[];
  metrics: {
    database: { queryLatencyP95: number; slowQueryCount: number; tableGrowth: { table: string; rowCount: number; sizeEstimate: string }[] };
    storage: { totalUsedBytes: number; totalFiles: number; vpsHealth?: VpsHealthDetails[] };
    traffic: { requestsPerMinute: number; topEndpoints: { endpoint: string; count: number; avgLatency: number }[] };
    abuse: { rateLimitViolations: number; bannedClients: number };
  };
  timestamp: string;
}

interface HealthCheck {
  status: "ok" | "warning" | "error";
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface Alert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  source: string;
  timestamp: string;
}

interface LatencyDataPoint {
  time: string;
  timestamp: number;
  db: number | null;
  edge: number | null;
  vps: number | null;
}

const SystemMonitoring = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState(false);
  const [latencyHistory, setLatencyHistory] = useState<LatencyDataPoint[]>([]);
  const [testingLatency, setTestingLatency] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("system-monitor", {
        body: {},
      });

      if (response.data) {
        setHealth(response.data);
        
        // Add to latency history - VPS latency now comes from Edge Function
        const now = new Date();
        const vpsDetails = response.data.metrics?.storage?.vpsHealth?.[0];
        const newPoint: LatencyDataPoint = {
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: now.getTime(),
          db: response.data.checks?.database?.latency || null,
          edge: response.data.checks?.edgeFunctions?.latency || null,
          vps: vpsDetails?.latency || response.data.checks?.storage?.latency || null,
        };
        
        setLatencyHistory(prev => {
          const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
          // Prune old data points (>10 min) and add new one
          const pruned = prev.filter(p => p.timestamp > tenMinutesAgo);
          return [...pruned, newPoint].slice(-30);
        });
      }
    } catch (error) {
      console.error("Error fetching health:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run full latency test - VPS is tested via Edge Function (browser can't reach VPS due to CORS)
  const runLatencyTest = async () => {
    setTestingLatency(true);
    lightHaptic();
    
    const now = new Date();
    const startDb = performance.now();
    
    try {
      // Test DB latency (direct from browser)
      await supabase.from("profiles").select("id").limit(1);
      const dbLatency = Math.round(performance.now() - startDb);
      
      // Test Edge latency (includes VPS check inside)
      const startEdge = performance.now();
      const { data: monitorData } = await supabase.functions.invoke("system-monitor", { body: {} });
      const edgeLatency = Math.round(performance.now() - startEdge);
      
      // VPS latency comes from the Edge Function (it can reach VPS, browser can't due to CORS)
      const vpsDetails = monitorData?.metrics?.storage?.vpsHealth?.[0];
      const vpsLatency = vpsDetails?.latency || monitorData?.checks?.storage?.latency || null;
      const vpsStatus = vpsDetails?.status || "unknown";
      
      const newPoint: LatencyDataPoint = {
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: now.getTime(),
        db: dbLatency,
        edge: edgeLatency,
        vps: vpsLatency,
      };
      
      setLatencyHistory(prev => {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const pruned = prev.filter(p => p.timestamp > tenMinutesAgo);
        return [...pruned, newPoint].slice(-30);
      });
      
      if (monitorData) {
        setHealth(monitorData);
      }
      
      const vpsMsg = vpsStatus === "healthy" 
        ? `VPS ${vpsLatency}ms` 
        : vpsStatus === "unreachable" 
          ? "VPS unreachable (firewall)" 
          : `VPS ${vpsStatus}`;
      
      toast.success(`DB ${dbLatency}ms | Edge ${edgeLatency}ms | ${vpsMsg}`);
    } catch (error) {
      toast.error("Latency test failed");
    } finally {
      setTestingLatency(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => {
      fetchHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const runBackgroundJobs = async () => {
    mediumHaptic();
    setRunningJobs(true);
    try {
      const response = await supabase.functions.invoke("background-jobs", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });

      if (response.data?.success) {
        toast.success(`Background jobs completed: ${response.data.summary?.succeeded}/${response.data.summary?.total} succeeded`);
      } else {
        toast.error("Some jobs failed");
      }
      fetchHealth();
    } catch (error) {
      toast.error("Failed to run jobs");
    } finally {
      setRunningJobs(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "warning":
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <XCircle className="w-5 h-5 text-rose-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "warning":
      case "degraded":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
  };

  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return "text-white/50";
    if (latency < 100) return "text-emerald-400";
    if (latency < 200) return "text-amber-400";
    return "text-rose-400";
  };

  const handleRefresh = () => {
    lightHaptic();
    fetchHealth();
  };

  const handleResetHistory = () => {
    lightHaptic();
    setLatencyHistory([]);
    toast.success("Latency history cleared");
  };
  
  // Get VPS status from health data
  const vpsDetails = health?.metrics?.storage?.vpsHealth?.[0];
  const vpsStatus = vpsDetails?.status || "unknown";
  const vpsError = vpsDetails?.error;

  // Get current latency values
  const currentLatency = latencyHistory.length > 0 ? latencyHistory[latencyHistory.length - 1] : null;

  // Calculate averages
  const avgLatency = {
    db: latencyHistory.filter(p => p.db).length > 0 
      ? Math.round(latencyHistory.reduce((sum, p) => sum + (p.db || 0), 0) / latencyHistory.filter(p => p.db).length)
      : null,
    edge: latencyHistory.filter(p => p.edge).length > 0
      ? Math.round(latencyHistory.reduce((sum, p) => sum + (p.edge || 0), 0) / latencyHistory.filter(p => p.edge).length)
      : null,
    vps: latencyHistory.filter(p => p.vps).length > 0
      ? Math.round(latencyHistory.reduce((sum, p) => sum + (p.vps || 0), 0) / latencyHistory.filter(p => p.vps).length)
      : null,
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
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-6 h-6 text-teal-400" />
                System Monitoring
              </h1>
              <p className="text-white/50 text-sm">
                Infrastructure health, metrics & scaling readiness
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={runLatencyTest} 
                disabled={testingLatency}
                className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <Gauge className={`w-4 h-4 ${testingLatency ? "animate-pulse" : ""}`} />
                Test
              </button>
              {latencyHistory.length > 0 && (
                <button 
                  onClick={handleResetHistory}
                  className="ios-button-secondary px-3 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white"
                  title="Clear latency history"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={handleRefresh} 
                disabled={loading}
                className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button 
                onClick={runBackgroundJobs} 
                disabled={runningJobs}
                className="ios-button-primary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <Play className={`w-4 h-4 ${runningJobs ? "animate-pulse" : ""}`} />
                Run Jobs
              </button>
            </div>
          </motion.div>

          {loading ? (
            <SkeletonStats count={4} />
          ) : (
            <>
              {/* Overall Status */}
              {health && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="animate-fade-up">
                  <GlassCard variant="elevated" className={`border-2 ${getStatusColor(health.status)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(health.status)}
                        <div>
                          <p className="text-lg font-semibold capitalize text-white">{health.status}</p>
                          <p className="text-sm text-white/50">
                            Last updated: {new Date(health.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="border-white/10 text-white/70">{health.alerts.length} Alerts</Badge>
                        <Badge variant="outline" className="border-white/10 text-white/70">{health.metrics.abuse.bannedClients} Banned</Badge>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* Real-time Latency Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <GlassCard className="ios-card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Database className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Database</p>
                          <p className="text-xs text-white/50">Supabase (Frankfurt)</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <p className={`text-3xl font-bold ${getLatencyColor(currentLatency?.db ?? null)}`}>
                          {currentLatency?.db ?? '—'}
                          <span className="text-sm font-normal text-white/50 ml-1">ms</span>
                        </p>
                        <p className="text-xs text-white/40">
                          Avg: {avgLatency.db ?? '—'}ms
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${currentLatency?.db && currentLatency.db < 100 ? 'border-emerald-500/30 text-emerald-400' : currentLatency?.db && currentLatency.db < 200 ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400'}`}
                      >
                        {currentLatency?.db && currentLatency.db < 100 ? 'Fast' : currentLatency?.db && currentLatency.db < 200 ? 'OK' : 'Slow'}
                      </Badge>
                    </div>
                  </GlassCard>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <GlassCard className="ios-card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">Edge Functions</p>
                          <p className="text-xs text-white/50">Supabase Edge</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <p className={`text-3xl font-bold ${getLatencyColor(currentLatency?.edge ?? null)}`}>
                          {currentLatency?.edge ?? '—'}
                          <span className="text-sm font-normal text-white/50 ml-1">ms</span>
                        </p>
                        <p className="text-xs text-white/40">
                          Avg: {avgLatency.edge ?? '—'}ms
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${currentLatency?.edge && currentLatency.edge < 150 ? 'border-emerald-500/30 text-emerald-400' : currentLatency?.edge && currentLatency.edge < 300 ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400'}`}
                      >
                        {currentLatency?.edge && currentLatency.edge < 150 ? 'Fast' : currentLatency?.edge && currentLatency.edge < 300 ? 'OK' : 'Slow'}
                      </Badge>
                    </div>
                  </GlassCard>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <GlassCard className="ios-card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vpsStatus === 'healthy' ? 'bg-teal-500/10' : vpsStatus === 'unreachable' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
                          <Server className={`w-5 h-5 ${vpsStatus === 'healthy' ? 'text-teal-400' : vpsStatus === 'unreachable' ? 'text-rose-400' : 'text-amber-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-white">VPS Storage</p>
                          <p className="text-xs text-white/50">EU (Frankfurt)</p>
                        </div>
                      </div>
                      {vpsStatus === 'unreachable' && (
                        <Badge variant="outline" className="border-rose-500/30 text-rose-400 text-xs">
                          Unreachable
                        </Badge>
                      )}
                    </div>
                    {vpsStatus === 'unreachable' ? (
                      <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <p className="text-sm text-rose-400 font-medium">VPS Not Responding</p>
                        <p className="text-xs text-white/50 mt-1">
                          {vpsError || "Check VPS firewall allows Supabase Edge IPs"}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <p className={`text-3xl font-bold ${getLatencyColor(currentLatency?.vps ?? null)}`}>
                            {currentLatency?.vps ?? '—'}
                            <span className="text-sm font-normal text-white/50 ml-1">ms</span>
                          </p>
                          <p className="text-xs text-white/40">
                            Avg: {avgLatency.vps ?? '—'}ms
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${currentLatency?.vps && currentLatency.vps < 100 ? 'border-emerald-500/30 text-emerald-400' : currentLatency?.vps && currentLatency.vps < 200 ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400'}`}
                        >
                          {currentLatency?.vps ? (currentLatency.vps < 100 ? 'Fast' : currentLatency.vps < 200 ? 'OK' : 'Slow') : 'N/A'}
                        </Badge>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              </div>

              {/* Latency Chart */}
              {latencyHistory.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <GlassCard>
                    <GlassCardHeader 
                      title="Latency Timeline" 
                      icon={<TrendingUp className="w-5 h-5 text-teal-400" />}
                      action={
                        <Badge variant="outline" className="border-white/10 text-white/50 text-xs">
                          Last {latencyHistory.length} samples
                        </Badge>
                      }
                    />
                    <div className="h-64 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={latencyHistory}>
                          <defs>
                            <linearGradient id="colorDb" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorEdge" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorVps" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="time" 
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.3)"
                            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                            label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0,0,0,0.8)', 
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              color: 'white'
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="db" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorDb)" 
                            name="Database"
                            connectNulls
                          />
                          <Area 
                            type="monotone" 
                            dataKey="edge" 
                            stroke="#a855f7" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorEdge)" 
                            name="Edge"
                            connectNulls
                          />
                          <Area 
                            type="monotone" 
                            dataKey="vps" 
                            stroke="#14b8a6" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorVps)" 
                            name="VPS"
                            connectNulls
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-white/50">Database</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-xs text-white/50">Edge Functions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-500" />
                        <span className="text-xs text-white/50">VPS Storage</span>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {/* Health Checks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {health && Object.entries(health.checks).map(([name, check], index) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="animate-fade-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <GlassCard className="ios-card-hover">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusColor(check.status)}`}>
                          {name === "database" && <Database className="w-5 h-5" />}
                          {name === "storage" && <HardDrive className="w-5 h-5" />}
                          {name === "edgeFunctions" && <Zap className="w-5 h-5" />}
                          {name === "backgroundJobs" && <Clock className="w-5 h-5" />}
                        </div>
                        {getStatusIcon(check.status)}
                      </div>
                      <p className="font-medium capitalize text-white">{name.replace(/([A-Z])/g, " $1")}</p>
                      {check.latency && (
                        <p className="text-sm text-white/50">{check.latency}ms latency</p>
                      )}
                      {check.message && (
                        <p className="text-xs text-white/40 mt-1">{check.message}</p>
                      )}
                    </GlassCard>
                  </motion.div>
                ))}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table Growth */}
                <GlassCard>
                  <GlassCardHeader 
                    title="Table Growth" 
                    icon={<BarChart3 className="w-5 h-5 text-teal-400" />} 
                  />
                  <div className="space-y-3">
                    {health?.metrics.database.tableGrowth.map((table) => (
                      <div key={table.table} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <span className="text-sm font-medium text-white">{table.table}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/50">{table.rowCount.toLocaleString()} rows</span>
                          <Badge variant="outline" className="border-white/10 text-white/70">{table.sizeEstimate}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Top Endpoints */}
                <GlassCard>
                  <GlassCardHeader 
                    title="Top Endpoints" 
                    icon={<TrendingUp className="w-5 h-5 text-teal-400" />} 
                  />
                  <div className="space-y-3">
                    {health?.metrics.traffic.topEndpoints.map((endpoint) => (
                      <div key={endpoint.endpoint} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <span className="text-sm font-medium truncate max-w-[200px] text-white">{endpoint.endpoint}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white/50">{endpoint.count} reqs</span>
                          <Badge variant={endpoint.avgLatency > 200 ? "destructive" : "outline"} className="border-white/10">
                            {endpoint.avgLatency}ms
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Abuse Protection */}
                <GlassCard>
                  <GlassCardHeader 
                    title="Abuse Protection" 
                    icon={<Shield className="w-5 h-5 text-teal-400" />} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-xl ios-glass-light">
                      <p className="text-2xl font-bold text-white">
                        {health?.metrics.abuse.rateLimitViolations || 0}
                      </p>
                      <p className="text-sm text-white/50">Rate Limit Hits</p>
                    </div>
                    <div className="text-center p-4 rounded-xl ios-glass-light">
                      <p className="text-2xl font-bold text-white">
                        {health?.metrics.abuse.bannedClients || 0}
                      </p>
                      <p className="text-sm text-white/50">Banned Clients</p>
                    </div>
                  </div>
                </GlassCard>

                {/* Storage Overview */}
                <GlassCard>
                  <GlassCardHeader 
                    title="Storage Overview" 
                    icon={<Server className="w-5 h-5 text-teal-400" />} 
                  />
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-white/50">Total Used</span>
                        <span className="text-sm font-medium text-white">
                          {formatBytes(health?.metrics.storage.totalUsedBytes || 0)}
                        </span>
                      </div>
                      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: '30%' }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-white/50">Total Files</span>
                      <span className="font-medium text-white">{health?.metrics.storage.totalFiles.toLocaleString()}</span>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Alerts */}
              {health && health.alerts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <GlassCard>
                    <GlassCardHeader 
                      title="Active Alerts" 
                      icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} 
                    />
                    <div className="space-y-2">
                      {health.alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-xl border ${
                            alert.level === "critical" ? "bg-rose-500/10 border-rose-500/20" :
                            alert.level === "warning" ? "bg-amber-500/10 border-amber-500/20" :
                            "bg-white/5 border-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm text-white">{alert.title}</p>
                              <p className="text-xs text-white/50">{alert.message}</p>
                            </div>
                            <Badge variant="outline" className="text-xs border-white/10 text-white/70">{alert.source}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default SystemMonitoring;

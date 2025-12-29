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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, StatCard } from "@/components/ios";
import { SkeletonStats, SkeletonCard } from "@/components/ios";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

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
    storage: { totalUsedBytes: number; totalFiles: number };
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

const SystemMonitoring = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningJobs, setRunningJobs] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("system-monitor", {
        body: {},
      });

      if (response.data) {
        setHealth(response.data);
      }
    } catch (error) {
      console.error("Error fetching health:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
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

  const handleRefresh = () => {
    lightHaptic();
    fetchHealth();
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

              {/* Health Checks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {health && Object.entries(health.checks).map(([name, check], index) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
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
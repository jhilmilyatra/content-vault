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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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

interface ScalingCheck {
  name: string;
  passed: boolean;
  message: string;
}

const SystemMonitoring = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [scalingChecks, setScalingChecks] = useState<ScalingCheck[]>([]);
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

      // Fetch scaling readiness
      const scalingResponse = await supabase.functions.invoke("system-monitor", {
        body: {},
        headers: { "Content-Type": "application/json" },
      });

      // Parse action from URL if needed - for now use health data
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

  const runBackgroundJobs = async (jobType: string) => {
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
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "warning":
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <XCircle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok":
      case "healthy":
        return "bg-success/10 text-success border-success/20";
      case "warning":
      case "degraded":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-destructive/10 text-destructive border-destructive/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              System Monitoring
            </h1>
            <p className="text-muted-foreground">
              Infrastructure health, metrics & scaling readiness
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => runBackgroundJobs("all")} disabled={runningJobs}>
              <Play className={`w-4 h-4 mr-2 ${runningJobs ? "animate-pulse" : ""}`} />
              Run Jobs
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        {health && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`border-2 ${getStatusColor(health.status)}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(health.status)}
                    <div>
                      <p className="text-lg font-semibold capitalize">{health.status}</p>
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(health.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{health.alerts.length} Alerts</Badge>
                    <Badge variant="outline">{health.metrics.abuse.bannedClients} Banned</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(check.status)}`}>
                      {name === "database" && <Database className="w-5 h-5" />}
                      {name === "storage" && <HardDrive className="w-5 h-5" />}
                      {name === "edgeFunctions" && <Zap className="w-5 h-5" />}
                      {name === "backgroundJobs" && <Clock className="w-5 h-5" />}
                    </div>
                    {getStatusIcon(check.status)}
                  </div>
                  <p className="font-medium capitalize">{name.replace(/([A-Z])/g, " $1")}</p>
                  {check.latency && (
                    <p className="text-sm text-muted-foreground">{check.latency}ms latency</p>
                  )}
                  {check.message && (
                    <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Table Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Table Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {health?.metrics.database.tableGrowth.map((table) => (
                  <div key={table.table} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{table.table}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{table.rowCount.toLocaleString()} rows</span>
                      <Badge variant="outline">{table.sizeEstimate}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Top Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {health?.metrics.traffic.topEndpoints.map((endpoint) => (
                  <div key={endpoint.endpoint} className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[200px]">{endpoint.endpoint}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{endpoint.count} reqs</span>
                      <Badge variant={endpoint.avgLatency > 200 ? "destructive" : "outline"}>
                        {endpoint.avgLatency}ms
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Abuse Protection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Abuse Protection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">
                    {health?.metrics.abuse.rateLimitViolations || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Rate Limit Hits</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold text-foreground">
                    {health?.metrics.abuse.bannedClients || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Banned Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Storage Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Total Used</span>
                    <span className="text-sm font-medium">
                      {formatBytes(health?.metrics.storage.totalUsedBytes || 0)}
                    </span>
                  </div>
                  <Progress value={30} className="h-2" />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Files</span>
                  <span className="font-medium">{health?.metrics.storage.totalFiles.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {health && health.alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {health.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.level === "critical" ? "bg-destructive/10 border-destructive/20" :
                      alert.level === "warning" ? "bg-amber-500/10 border-amber-500/20" :
                      "bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{alert.source}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SystemMonitoring;
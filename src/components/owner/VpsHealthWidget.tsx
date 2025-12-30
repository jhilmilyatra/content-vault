import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Cpu,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface VpsHealthData {
  status: "healthy" | "degraded" | "offline";
  timestamp: string;
  version: string;
  storage: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    fileCount: number;
    totalGB: string;
    usedGB: string;
    freeGB: string;
    usagePercent: string;
  };
  endpoints: {
    total: number;
    available: number;
    missing: number;
    allAvailable: boolean;
    missingList: string[];
  };
  environment: {
    nodeVersion: string;
    platform: string;
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}

const VpsHealthWidget = () => {
  const [health, setHealth] = useState<VpsHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("vps-owner-stats", {
        body: { action: "health" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setHealth(response.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Health check failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to VPS");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getStatusColor = () => {
    if (error || !health) return "text-red-400";
    if (health.status === "healthy") return "text-emerald-400";
    if (health.status === "degraded") return "text-amber-400";
    return "text-red-400";
  };

  const getStatusBg = () => {
    if (error || !health) return "bg-red-500/10 border-red-500/20";
    if (health.status === "healthy") return "bg-emerald-500/10 border-emerald-500/20";
    if (health.status === "degraded") return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getStatusIcon = () => {
    if (error || !health) return <WifiOff className="w-5 h-5" />;
    if (health.status === "healthy") return <CheckCircle className="w-5 h-5" />;
    if (health.status === "degraded") return <AlertTriangle className="w-5 h-5" />;
    return <XCircle className="w-5 h-5" />;
  };

  return (
    <GlassCard variant="elevated" className="animate-fade-up">
      <GlassCardHeader
        title="VPS Server Health"
        icon={<Server className="w-5 h-5 text-primary" />}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Status Banner */}
        <motion.div
          className={cn(
            "flex items-center gap-3 p-4 rounded-2xl border",
            getStatusBg()
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={getStatusColor()}>{getStatusIcon()}</div>
          <div className="flex-1">
            <p className={cn("font-medium", getStatusColor())}>
              {error
                ? "Connection Failed"
                : health?.status === "healthy"
                ? "All Systems Operational"
                : health?.status === "degraded"
                ? "Degraded Performance"
                : "Server Offline"}
            </p>
            <p className="text-xs text-muted-foreground">
              Last checked: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          {health && (
            <span className="text-xs text-muted-foreground">v{health.version}</span>
          )}
        </motion.div>

        {error ? (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure the VPS server is running and accessible.
            </p>
          </div>
        ) : health ? (
          <>
            {/* Endpoint Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Endpoints</span>
                <span className="text-sm font-medium">
                  {health.endpoints.available}/{health.endpoints.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    health.endpoints.allAvailable
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(health.endpoints.available / health.endpoints.total) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              {!health.endpoints.allAvailable && (
                <div className="text-xs text-amber-400">
                  Missing: {health.endpoints.missingList.join(", ")}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl ios-glass-subtle">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span className="text-xs">Storage</span>
                </div>
                <p className="text-sm font-medium">
                  {health.storage.usedGB} / {health.storage.totalGB} GB
                </p>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden mt-2">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${health.storage.usagePercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl ios-glass-subtle">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="text-xs">Memory</span>
                </div>
                <p className="text-sm font-medium">
                  {formatBytes(health.environment.memoryUsage.heapUsed)}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {formatBytes(health.environment.memoryUsage.heapTotal)}
                </p>
              </div>

              <div className="p-3 rounded-xl ios-glass-subtle">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">Uptime</span>
                </div>
                <p className="text-sm font-medium">
                  {formatUptime(health.environment.uptime)}
                </p>
              </div>

              <div className="p-3 rounded-xl ios-glass-subtle">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="text-xs">Files</span>
                </div>
                <p className="text-sm font-medium">
                  {health.storage.fileCount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Node Info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-white/5">
              <span>Node {health.environment.nodeVersion}</span>
              <span>{health.environment.platform}</span>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-muted/10 animate-pulse"
              />
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default VpsHealthWidget;
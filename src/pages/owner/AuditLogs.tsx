import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Search,
  Download,
  User,
  Shield,
  Settings,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader, IosList, IosListItem } from "@/components/ios";
import { SkeletonList } from "@/components/ios";
import { lightHaptic } from "@/lib/haptics";

interface AuditLog {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  entity_type: string;
  details: unknown;
  created_at: string;
  actor_email?: string;
  target_email?: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const { data: auditLogs, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const userIds = new Set<string>();
      auditLogs?.forEach((log) => {
        if (log.actor_id) userIds.add(log.actor_id);
        if (log.target_user_id) userIds.add(log.target_user_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.email]));

      const logsWithEmails = auditLogs?.map((log) => ({
        ...log,
        actor_email: log.actor_id ? profileMap.get(log.actor_id) || "Unknown" : "System",
        target_email: log.target_user_id ? profileMap.get(log.target_user_id) || "Unknown" : null,
      })) || [];

      setLogs(logsWithEmails);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("role")) return <Shield className="w-4 h-4" />;
    if (action.includes("subscription")) return <CreditCard className="w-4 h-4" />;
    if (action.includes("user")) return <User className="w-4 h-4" />;
    return <Settings className="w-4 h-4" />;
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      role_change: "bg-violet-500/20 text-violet-400 border-violet-500/30",
      subscription_change: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      user_suspended: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      user_activated: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };

    return (
      <Badge className={colors[action] || "bg-white/10 text-white/70 border-white/20"}>
        {action.replace(/_/g, " ")}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterAction === "all" || log.action === filterAction;

    return matchesSearch && matchesFilter;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

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
                <FileText className="w-6 h-6 text-teal-400" />
                Audit Logs
              </h1>
              <p className="text-white/50 text-sm">
                Track all system actions and changes
              </p>
            </div>
            <button 
              onClick={() => lightHaptic()}
              className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 ios-input"
              />
            </div>
            <div className="relative">
              <select
                value={filterAction}
                onChange={(e) => {
                  lightHaptic();
                  setFilterAction(e.target.value);
                }}
                className="ios-input appearance-none pr-10 cursor-pointer min-w-[180px]"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          </div>

          {/* Logs */}
          <GlassCard>
            <GlassCardHeader 
              title={`Activity Log (${filteredLogs.length})`} 
              icon={<FileText className="w-5 h-5 text-teal-400" />} 
            />
            
            {loading ? (
              <SkeletonList count={8} />
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <IosList>
                {filteredLogs.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  >
                    <IosListItem
                      icon={getActionIcon(log.action)}
                      title={`${log.action.replace(/_/g, " ")} by ${log.actor_email}${log.target_email ? ` → ${log.target_email}` : ""}`}
                      subtitle={
                        log.details && typeof log.details === 'object' 
                          ? (log.details as Record<string, unknown>).reason as string || ""
                          : ""
                      }
                      value={formatDate(log.created_at)}
                    />
                  </motion.div>
                ))}
              </IosList>
            )}
          </GlassCard>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default AuditLogs;
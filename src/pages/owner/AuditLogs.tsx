import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Search,
  Filter,
  Download,
  User,
  Shield,
  Settings,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/ui/PageTransition";

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
  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10";

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
              <p className="text-white/50">
                Track all system actions and changes
              </p>
            </div>
            <Button variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/10">
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <Card className={glassCard}>
            <CardHeader>
              <CardTitle className="text-white">Activity Log ({filteredLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-white/50">
                  Loading logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-white/50">
                  No audit logs found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-start gap-4 p-4 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/50">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getActionBadge(log.action)}
                          <span className="text-sm text-white/50">
                            by {log.actor_email}
                          </span>
                          {log.target_email && (
                            <span className="text-sm text-white/50">
                              → {log.target_email}
                            </span>
                          )}
                        </div>
                        {log.details && typeof log.details === 'object' && (
                          <p className="text-sm text-white/40 mt-1">
                            {(log.details as Record<string, unknown>).reason as string || JSON.stringify(log.details)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-white/40 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default AuditLogs;
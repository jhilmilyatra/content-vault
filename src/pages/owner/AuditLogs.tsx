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

      // Fetch profiles for actor and target
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
      role_change: "bg-violet-500/20 text-violet-500 border-violet-500/30",
      subscription_change: "bg-amber-500/20 text-amber-500 border-amber-500/30",
      user_suspended: "bg-destructive/20 text-destructive border-destructive/30",
      user_activated: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    };

    return (
      <Badge className={colors[action] || "bg-muted text-muted-foreground"}>
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">
              Track all system actions and changes
            </p>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
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
        <Card>
          <CardHeader>
            <CardTitle>Activity Log ({filteredLogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
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
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(log.action)}
                        <span className="text-sm text-muted-foreground">
                          by {log.actor_email}
                        </span>
                        {log.target_email && (
                          <span className="text-sm text-muted-foreground">
                            → {log.target_email}
                          </span>
                        )}
                      </div>
                      {log.details && typeof log.details === 'object' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {(log.details as Record<string, unknown>).reason as string || JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  FileWarning,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Report {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reported_file_id: string | null;
  report_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  reporter_email?: string;
  reported_user_email?: string;
}

const ReportManagement = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolution, setResolution] = useState<"resolved" | "dismissed">("resolved");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch related user emails
      const userIds = new Set<string>();
      data?.forEach((r) => {
        if (r.reporter_id) userIds.add(r.reporter_id);
        if (r.reported_user_id) userIds.add(r.reported_user_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.email]));

      const reportsWithEmails = data?.map((r) => ({
        ...r,
        reporter_email: r.reporter_id ? profileMap.get(r.reporter_id) || "Unknown" : null,
        reported_user_email: r.reported_user_id
          ? profileMap.get(r.reported_user_id) || "Unknown"
          : null,
      })) || [];

      setReports(reportsWithEmails);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async () => {
    if (!selectedReport || !resolutionNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide resolution notes",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("reports")
        .update({
          status: resolution,
          resolution_notes: resolutionNotes,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      // Log audit
      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: selectedReport.reported_user_id,
        action: `report_${resolution}`,
        entity_type: "reports",
        entity_id: selectedReport.id,
        details: { notes: resolutionNotes },
      });

      toast({ title: `Report ${resolution}` });
      setResolveDialogOpen(false);
      setSelectedReport(null);
      setResolutionNotes("");
      fetchReports();
    } catch (error) {
      console.error("Error resolving report:", error);
      toast({
        title: "Error",
        description: "Failed to resolve report",
        variant: "destructive",
      });
    }
  };

  const handleStartReview = async (report: Report) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: "reviewing" })
        .eq("id", report.id);

      if (error) throw error;
      toast({ title: "Report marked as reviewing" });
      fetchReports();
    } catch (error) {
      console.error("Error updating report:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-500/20 text-amber-500 border-amber-500/30",
      reviewing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
      resolved: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
      dismissed: "bg-muted text-muted-foreground border-muted",
    };
    return <Badge className={styles[status] || ""}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      abuse: "bg-destructive/20 text-destructive",
      copyright: "bg-violet-500/20 text-violet-500",
      spam: "bg-amber-500/20 text-amber-500",
      inappropriate: "bg-rose-500/20 text-rose-400",
      other: "bg-muted text-muted-foreground",
    };
    return <Badge variant="outline" className={styles[type] || ""}>{type}</Badge>;
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reporter_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reported_user_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileWarning className="w-6 h-6 text-amber-500" />
            Report Management
          </h1>
          <p className="text-muted-foreground">
            Review and resolve user reports
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Reports ({filteredReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading reports...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                No reports found
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {getTypeBadge(report.report_type)}
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-foreground mb-2">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Reporter: {report.reporter_email || "Anonymous"}</span>
                          {report.reported_user_email && (
                            <span>Reported: {report.reported_user_email}</span>
                          )}
                          <span>
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {report.resolution_notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Resolution: {report.resolution_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {report.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartReview(report)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        )}
                        {(report.status === "pending" || report.status === "reviewing") && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setResolution("resolved");
                                setResolveDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Resolve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReport(report);
                                setResolution("dismissed");
                                setResolveDialogOpen(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Dismiss
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resolution === "resolved" ? "Resolve Report" : "Dismiss Report"}
              </DialogTitle>
              <DialogDescription>
                Please provide notes for this action.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="notes">Resolution Notes *</Label>
              <Textarea
                id="notes"
                placeholder="Enter notes about the resolution..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={resolution === "resolved" ? "default" : "secondary"}
                onClick={handleResolveReport}
              >
                {resolution === "resolved" ? "Resolve" : "Dismiss"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ReportManagement;

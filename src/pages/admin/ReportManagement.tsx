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
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { SkeletonList } from "@/components/ios/SkeletonLoader";
import { IosSheet } from "@/components/ios/IosSheet";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { lightHaptic } from "@/lib/haptics";

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
  const [resolveSheetOpen, setResolveSheetOpen] = useState(false);
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

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: selectedReport.reported_user_id,
        action: `report_${resolution}`,
        entity_type: "reports",
        entity_id: selectedReport.id,
        details: { notes: resolutionNotes },
      });

      toast({ title: `Report ${resolution}` });
      setResolveSheetOpen(false);
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
    lightHaptic();
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
    return (
      <Badge className={`${styles[status] || ""} rounded-full px-2.5 text-xs font-medium border`}>
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      abuse: "bg-destructive/20 text-destructive",
      copyright: "bg-violet-500/20 text-violet-500",
      spam: "bg-amber-500/20 text-amber-500",
      inappropriate: "bg-rose-500/20 text-rose-400",
      other: "bg-muted text-muted-foreground",
    };
    return (
      <Badge variant="outline" className={`${styles[type] || ""} rounded-full px-2.5 text-xs`}>
        {type}
      </Badge>
    );
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
      <motion.div 
        className="space-y-6 px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl ios-glass flex items-center justify-center">
              <FileWarning className="w-5 h-5 text-amber-500" />
            </div>
            Report Management
          </h1>
          <p className="text-muted-foreground mt-1 ml-13">
            Review and resolve user reports
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-2xl ios-glass border-0 text-base"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-12 rounded-2xl ios-glass border-0">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="ios-glass-elevated rounded-2xl">
              <SelectItem value="all" className="rounded-xl">All</SelectItem>
              <SelectItem value="pending" className="rounded-xl">Pending</SelectItem>
              <SelectItem value="reviewing" className="rounded-xl">Reviewing</SelectItem>
              <SelectItem value="resolved" className="rounded-xl">Resolved</SelectItem>
              <SelectItem value="dismissed" className="rounded-xl">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <GlassCardHeader
            title={`Reports (${filteredReports.length})`}
            icon={<FileWarning className="w-5 h-5" />}
          />
          
          <div className="p-4">
            {loading ? (
              <SkeletonList />
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No reports found</p>
              </div>
            ) : (
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {filteredReports.map((report) => (
                  <motion.div
                    key={report.id}
                    variants={staggerItem}
                    whileTap={{ scale: 0.98 }}
                    className="p-4 rounded-2xl ios-glass-subtle hover:bg-muted/30 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {getTypeBadge(report.report_type)}
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-foreground mb-2 line-clamp-2">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>From: {report.reporter_email || "Anonymous"}</span>
                          {report.reported_user_email && (
                            <span>• {report.reported_user_email}</span>
                          )}
                          <span>• {new Date(report.created_at).toLocaleDateString()}</span>
                        </div>
                        {report.resolution_notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic p-2 rounded-lg bg-muted/30">
                            {report.resolution_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {(report.status === "pending" || report.status === "reviewing") && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                        {report.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartReview(report)}
                            className="rounded-xl h-9 text-xs flex-1"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            lightHaptic();
                            setSelectedReport(report);
                            setResolution("resolved");
                            setResolveSheetOpen(true);
                          }}
                          className="rounded-xl h-9 text-xs flex-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                          Resolve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            lightHaptic();
                            setSelectedReport(report);
                            setResolution("dismissed");
                            setResolveSheetOpen(true);
                          }}
                          className="rounded-xl h-9 text-xs flex-1"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1.5" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* Resolve Sheet */}
        <IosSheet
          open={resolveSheetOpen}
          onClose={() => setResolveSheetOpen(false)}
          title={resolution === "resolved" ? "Resolve Report" : "Dismiss Report"}
          description="Please provide notes for this action."
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setResolveSheetOpen(false)}
                className="w-full rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button
                variant={resolution === "resolved" ? "default" : "secondary"}
                onClick={handleResolveReport}
                className="w-full rounded-xl h-12"
              >
                {resolution === "resolved" ? "Resolve Report" : "Dismiss Report"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">
                Resolution Notes *
              </Label>
              <Textarea
                id="notes"
                placeholder="Enter notes about the resolution..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-2 rounded-xl ios-glass border-0 min-h-[120px]"
              />
            </div>
          </div>
        </IosSheet>
      </motion.div>
    </DashboardLayout>
  );
};

export default ReportManagement;

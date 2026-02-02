import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Database,
  Shield,
  Code,
  FileJson,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Key,
  Zap,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExportStats {
  tables: number;
  rows: number;
  policies: number;
  functions: number;
  buckets: number;
  edgeFunctions: number;
}

const DataExport = () => {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<"json" | "sql">("json");
  const [includeData, setIncludeData] = useState(true);
  const [lastExport, setLastExport] = useState<ExportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("data-export", {
        body: { format, includeData },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      // Calculate stats
      const tableData = data.tables || {} as Record<string, unknown[]>;
      const stats: ExportStats = {
        tables: Object.keys(tableData).length,
        rows: Object.values(tableData).reduce<number>(
          (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
          0
        ),
        policies: (data.rlsPolicies || []).length,
        functions: (data.functions || []).length,
        buckets: (data.storageBuckets || []).length,
        edgeFunctions: (data.edgeFunctions || []).length,
      };
      setLastExport(stats);

      // Download file
      const blob = new Blob(
        [format === "json" ? JSON.stringify(data, null, 2) : data],
        { type: format === "json" ? "application/json" : "text/plain" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lovable-export-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export completed successfully");
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Export failed");
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportItems = [
    {
      icon: Database,
      label: "Database Tables",
      description: "All table data including profiles, files, folders, etc.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Shield,
      label: "RLS Policies",
      description: "Row-level security policies for all tables",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Code,
      label: "Database Functions",
      description: "PL/pgSQL functions and triggers",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      icon: Zap,
      label: "Edge Functions",
      description: "List of deployed serverless functions",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: HardDrive,
      label: "Storage Buckets",
      description: "Storage configuration and bucket info",
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
    {
      icon: Key,
      label: "Secret Names",
      description: "List of configured secrets (values not included)",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">Data Export</h1>
          <p className="text-muted-foreground">
            Export your complete backend configuration and data
          </p>
        </motion.div>

        {/* What's Included */}
        <GlassCard variant="elevated">
          <GlassCardHeader
            title="What's Included"
            icon={<Database className="w-5 h-5 text-primary" />}
          />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exportItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl",
                  item.bg
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0 mt-0.5", item.color)} />
                <div>
                  <p className="font-medium text-foreground text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassCard>

        {/* Export Options */}
        <GlassCard variant="elevated">
          <GlassCardHeader
            title="Export Options"
            icon={<Download className="w-5 h-5 text-primary" />}
          />
          <div className="p-4 space-y-4">
            {/* Format Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Export Format
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setFormat("json")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                    format === "json"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <FileJson className="w-5 h-5" />
                  <span className="font-medium">JSON</span>
                </button>
                <button
                  onClick={() => setFormat("sql")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all",
                    format === "sql"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">SQL</span>
                </button>
              </div>
            </div>

            {/* Include Data Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <div>
                <p className="font-medium text-foreground text-sm">Include Table Data</p>
                <p className="text-xs text-muted-foreground">
                  Export all rows from database tables
                </p>
              </div>
              <button
                onClick={() => setIncludeData(!includeData)}
                className={cn(
                  "w-12 h-7 rounded-full transition-colors relative",
                  includeData ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    includeData ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full h-12"
              size="lg"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Export All Data
                </>
              )}
            </Button>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Success Stats */}
            {lastExport && !error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-medium text-emerald-400">Export Complete</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.tables}</p>
                    <p className="text-xs text-muted-foreground">Tables</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.rows.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Rows</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.policies}</p>
                    <p className="text-xs text-muted-foreground">Policies</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.functions}</p>
                    <p className="text-xs text-muted-foreground">Functions</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.edgeFunctions}</p>
                    <p className="text-xs text-muted-foreground">Edge Funcs</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{lastExport.buckets}</p>
                    <p className="text-xs text-muted-foreground">Buckets</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* Info */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> This export includes database structure and data, but not:
          </p>
          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Actual secret values (only names are listed)</li>
            <li>Storage file contents (bucket config only)</li>
            <li>Edge function source code (available in your codebase)</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DataExport;

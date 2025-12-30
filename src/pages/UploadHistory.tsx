import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatFileSize } from "@/lib/fileService";
import { lightHaptic } from "@/lib/haptics";
import { 
  Search, 
  Filter, 
  FileVideo, 
  FileImage, 
  FileText, 
  FileAudio,
  File,
  Calendar,
  Bot,
  CheckCircle2,
  Clock,
  ChevronRight,
  Download,
  ArrowUpDown,
  RefreshCw
} from "lucide-react";

interface FileRecord {
  id: string;
  name: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  folder_id: string | null;
  folder?: { name: string } | null;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith("video/")) return FileVideo;
  if (mimeType?.startsWith("image/")) return FileImage;
  if (mimeType?.startsWith("audio/")) return FileAudio;
  if (mimeType?.includes("pdf") || mimeType?.includes("document")) return FileText;
  return File;
};

const getFileCategory = (mimeType: string): string => {
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("audio/")) return "audio";
  if (mimeType?.includes("pdf") || mimeType?.includes("document")) return "document";
  return "other";
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

type SortField = "created_at" | "name" | "size_bytes";
type SortOrder = "asc" | "desc";
type TimeFilter = "all" | "today" | "week" | "month";
type TypeFilter = "all" | "video" | "image" | "audio" | "document" | "other";

const UploadHistory = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const fetchFiles = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("files")
        .select("id, name, original_name, size_bytes, mime_type, created_at, folder_id")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order(sortField, { ascending: sortOrder === "asc" })
        .limit(100);

      // Apply time filter
      if (timeFilter !== "all") {
        const now = new Date();
        let startDate: Date;
        
        switch (timeFilter) {
          case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte("created_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching files:", error);
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [user, sortField, sortOrder, timeFilter]);

  const handleRefresh = () => {
    lightHaptic();
    setRefreshing(true);
    fetchFiles();
  };

  const toggleSortOrder = () => {
    lightHaptic();
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
  };

  // Filter and search files
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.original_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType = typeFilter === "all" || getFileCategory(file.mime_type) === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [files, searchQuery, typeFilter]);

  // Group files by date
  const groupedFiles = useMemo(() => {
    const groups: { [key: string]: FileRecord[] } = {};
    
    filteredFiles.forEach(file => {
      const date = new Date(file.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let groupKey: string;
      
      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
        groupKey = "This Week";
      } else if (date.getTime() > today.getTime() - 30 * 24 * 60 * 60 * 1000) {
        groupKey = "This Month";
      } else {
        groupKey = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(file);
    });
    
    return groups;
  }, [filteredFiles]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const stats = useMemo(() => {
    const totalSize = filteredFiles.reduce((acc, file) => acc + file.size_bytes, 0);
    const categories = filteredFiles.reduce((acc, file) => {
      const cat = getFileCategory(file.mime_type);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return { totalSize, categories, count: filteredFiles.length };
  }, [filteredFiles]);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/30">
                <Bot className="w-6 h-6 text-background" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                  Upload History
                </h1>
                <p className="text-muted-foreground text-sm">
                  View all your uploaded files
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </motion.div>

          {/* Stats Row */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <div className="ios-glass-subtle rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Total Files</p>
            </div>
            <div className="ios-glass-subtle rounded-xl p-4">
              <p className="text-2xl font-bold text-foreground">{formatFileSize(stats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total Size</p>
            </div>
            <div className="ios-glass-subtle rounded-xl p-4">
              <p className="text-2xl font-bold text-primary">{stats.categories.video || 0}</p>
              <p className="text-xs text-muted-foreground">Videos</p>
            </div>
            <div className="ios-glass-subtle rounded-xl p-4">
              <p className="text-2xl font-bold text-emerald-400">{stats.categories.image || 0}</p>
              <p className="text-xs text-muted-foreground">Images</p>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/30 border-white/10"
              />
            </div>

            {/* Time Filter */}
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-full sm:w-36 bg-muted/30 border-white/10">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="w-full sm:w-36 bg-muted/30 border-white/10">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-full sm:w-36 bg-muted/30 border-white/10">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="size_bytes">Size</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortOrder}
              className="shrink-0"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
            </Button>
          </motion.div>

          {/* File List */}
          <GlassCard variant="elevated">
            <GlassCardHeader 
              title={`Files (${filteredFiles.length})`}
              icon={<Download className="w-5 h-5 text-primary" />}
            />

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                    <div className="w-11 h-11 rounded-xl bg-muted/50" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/50 rounded w-3/4" />
                      <div className="h-3 bg-muted/30 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-2">No files found</p>
                <p className="text-sm text-muted-foreground/60">
                  {searchQuery ? "Try a different search term" : "Upload files using your Telegram bot"}
                </p>
              </div>
            ) : (
              <motion.div 
                className="space-y-6"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {Object.entries(groupedFiles).map(([groupName, groupFiles]) => (
                  <div key={groupName} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {groupName}
                      <span className="text-muted-foreground/50">({groupFiles.length})</span>
                    </p>
                    
                    <AnimatePresence>
                      {groupFiles.map((file) => {
                        const Icon = getFileIcon(file.mime_type);
                        const category = getFileCategory(file.mime_type);
                        
                        return (
                          <motion.div
                            key={file.id}
                            variants={itemVariants}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-all group cursor-pointer"
                          >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                              category === "video" ? "bg-primary/20" :
                              category === "image" ? "bg-emerald-500/20" :
                              category === "audio" ? "bg-violet-500/20" :
                              "bg-muted/50"
                            }`}>
                              <Icon className={`w-5 h-5 ${
                                category === "video" ? "text-primary" :
                                category === "image" ? "text-emerald-400" :
                                category === "audio" ? "text-violet-400" :
                                "text-muted-foreground"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{formatFileSize(file.size_bytes)}</span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                <span>{formatDate(file.created_at)}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            )}
          </GlassCard>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default UploadHistory;

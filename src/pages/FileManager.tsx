import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageTransition } from "@/components/ui/PageTransition";
import { LazyImage } from "@/components/ui/LazyImage";
import { GlassCard } from "@/components/ios/GlassCard";
import { PremiumOnboarding } from "@/components/onboarding/PremiumOnboarding";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  uploadFile,
  deleteFile,
  createFolder,
  renameFile,
  renameFolder,
  deleteFolder,
  getFileUrl,
  formatFileSize,
  updateBandwidthUsage,
  updateStorageUsage,
  type FileItem,
  type FolderItem,
  type UploadProgress,
} from "@/lib/fileService";
import UploadProgressBar from "@/components/files/UploadProgressBar";
import UploadFAB from "@/components/files/UploadFAB";
import { UploadZone } from "@/components/files/UploadZone";
import {
  FolderOpen,
  FileVideo,
  FileImage,
  FileText,
  FileArchive,
  FileAudio,
  File,
  Upload,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Download,
  ChevronRight,
  Home,
  Search,
  Grid,
  List,
  X,
  Loader2,
  Share2,
  CheckSquare,
  Eye,
  Sparkles,
  HardDrive,
  Clock,
} from "lucide-react";
import ShareDialog from "@/components/files/ShareDialog";
import ShareFolderDialog from "@/components/files/ShareFolderDialog";
import BulkActionsBar from "@/components/files/BulkActionsBar";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const FileManager = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Files" },
  ]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressList, setUploadProgressList] = useState<UploadProgress[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: "file" | "folder"; id: string; name: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteFolderConfirmOpen, setDeleteFolderConfirmOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [shareFolderOpen, setShareFolderOpen] = useState(false);
  const [folderToShare, setFolderToShare] = useState<FolderItem | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user has seen onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding && user) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleOnboardingComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboarding(false);
  };

  const fetchContents = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let foldersQuery = supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (currentFolderId) {
        foldersQuery = foldersQuery.eq("parent_id", currentFolderId);
      } else {
        foldersQuery = foldersQuery.is("parent_id", null);
      }

      const { data: foldersData, error: foldersError } = await foldersQuery;

      if (foldersError) throw foldersError;

      let filesQuery = supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (currentFolderId) {
        filesQuery = filesQuery.eq("folder_id", currentFolderId);
      } else {
        filesQuery = filesQuery.is("folder_id", null);
      }

      const { data: filesData, error: filesError } = await filesQuery;

      if (filesError) throw filesError;

      setFolders((foldersData as FolderItem[]) || []);
      setFiles((filesData as FileItem[]) || []);
    } catch (error) {
      console.error("Error fetching contents:", error);
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !user) return;
    await processFileUpload(Array.from(selectedFiles));
  };

  const processFileUpload = async (fileList: File[]) => {
    if (!fileList.length || !user) return;

    setUploading(true);
    mediumHaptic();
    
    const initialProgress: UploadProgress[] = fileList.map((file) => ({
      loaded: 0,
      total: file.size,
      percentage: 0,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'preparing' as const,
    }));
    setUploadProgressList(initialProgress);

    try {
      // Parallel upload configuration
      const PARALLEL_UPLOADS = 3;
      const results: FileItem[] = [];
      const queue = [...fileList];
      let activeUploads = 0;
      let completedCount = 0;

      const uploadNext = async (): Promise<void> => {
        while (queue.length > 0 && activeUploads < PARALLEL_UPLOADS) {
          const file = queue.shift();
          if (!file) break;
          
          const fileIndex = fileList.indexOf(file);
          activeUploads++;

          try {
            const result = await uploadFile(file, user.id, currentFolderId, (progress) => {
              if (typeof progress === 'object') {
                setUploadProgressList((prev) => {
                  const updated = [...prev];
                  updated[fileIndex] = progress;
                  return updated;
                });
              }
            });
            results.push(result);
            completedCount++;
            
            // Update bandwidth and storage usage after successful upload
            await Promise.all([
              updateBandwidthUsage(user.id, file.size),
              updateStorageUsage(user.id, file.size),
            ]);
          } catch (error) {
            console.error(`Upload error for ${file.name}:`, error);
          } finally {
            activeUploads--;
          }
        }
      };

      // Start parallel upload workers
      const workers = Array.from(
        { length: Math.min(PARALLEL_UPLOADS, fileList.length) },
        () => uploadNext()
      );

      await Promise.all(workers);

      toast({
        title: "Success",
        description: `${completedCount} file(s) uploaded successfully`,
      });

      fetchContents();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgressList([]);
      }, 1500);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      await processFileUpload(droppedFiles);
    }
  };

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;

    try {
      await createFolder(user.id, newFolderName.trim(), currentFolderId);
      lightHaptic();
      toast({ title: "Folder created" });
      setCreateFolderOpen(false);
      setNewFolderName("");
      fetchContents();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleNavigateToFolder = async (folderId: string, folderName: string) => {
    lightHaptic();
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    lightHaptic();
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;

    try {
      if (renameTarget.type === "file") {
        await renameFile(renameTarget.id, newName.trim());
      } else {
        await renameFolder(renameTarget.id, newName.trim());
      }
      lightHaptic();
      toast({ title: "Renamed successfully" });
      setRenameDialogOpen(false);
      setRenameTarget(null);
      setNewName("");
      fetchContents();
    } catch (error) {
      console.error("Error renaming:", error);
      toast({
        title: "Error",
        description: "Failed to rename",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    try {
      await deleteFile(file.id, file.storage_path);
      lightHaptic();
      toast({ title: "File moved to trash" });
      fetchContents();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
      lightHaptic();
      toast({ title: "Folder deleted" });
      fetchContents();
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast({
        title: "Error",
        description: "Failed to delete folder. Make sure it's empty.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=get`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(blobUrl);
      lightHaptic();

      toast({
        title: "Download started",
        description: `Downloading ${file.original_name}`,
      });
    } catch (error) {
      console.error("Error downloading:", error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const getFileIconComponent = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return FileImage;
    if (mimeType.startsWith("video/")) return FileVideo;
    if (mimeType.startsWith("audio/")) return FileAudio;
    if (mimeType === "application/pdf") return FileText;
    if (mimeType.includes("zip") || mimeType.includes("rar")) return FileArchive;
    return File;
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate storage stats
  const totalSize = files.reduce((acc, file) => acc + file.size_bytes, 0);
  const recentFiles = files.filter(f => {
    const fileDate = new Date(f.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return fileDate > weekAgo;
  }).length;

  return (
    <DashboardLayout>
      <PageTransition>
        {/* Premium Onboarding */}
        <PremiumOnboarding 
          isOpen={showOnboarding} 
          onComplete={handleOnboardingComplete} 
        />

        <div 
          className={`space-y-6 min-h-[calc(100vh-8rem)] transition-all ${isDragging ? 'relative' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-gold/5 border-2 border-dashed border-gold/50 rounded-3xl flex items-center justify-center backdrop-blur-sm"
              >
                <div className="text-center">
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gold/20 to-gold-dark/20 flex items-center justify-center mx-auto mb-4 border border-gold/30 shadow-2xl shadow-gold/20"
                  >
                    <Upload className="w-12 h-12 text-gold" />
                  </motion.div>
                  <p className="text-2xl font-bold text-white font-outfit">Drop files here</p>
                  <p className="text-white/50 mt-1">Release to upload your files</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8">
              {/* Ambient glow */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-gold/20 to-transparent rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-2xl" />
              
              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30"
                  >
                    <HardDrive className="w-7 h-7 text-black" />
                  </motion.div>
                  <div>
                    <motion.h1 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-outfit"
                    >
                      Files
                    </motion.h1>
                    <motion.p 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                      className="text-white/50 mt-1"
                    >
                      Manage your files and folders
                    </motion.p>
                  </div>
                </div>

                {/* Quick Stats */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap gap-4 lg:gap-6"
                >
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <FolderOpen className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Folders</p>
                      <p className="text-sm font-semibold text-white">{folders.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <File className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Files</p>
                      <p className="text-sm font-semibold text-white">{files.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="p-2 rounded-lg bg-gold/20">
                      <HardDrive className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Storage</p>
                      <p className="text-sm font-semibold text-white">{formatFileSize(totalSize)}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Desktop buttons */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="hidden sm:flex items-center gap-3"
                >
                  <Button
                    variant={selectionMode ? "secondary" : "outline"}
                    onClick={() => {
                      lightHaptic();
                      setSelectionMode(!selectionMode);
                      if (selectionMode) {
                        setSelectedFiles([]);
                        setSelectedFolders([]);
                      }
                    }}
                    className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {selectionMode ? "Cancel" : "Select"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      lightHaptic();
                      setCreateFolderOpen(true);
                    }} 
                    className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Folder
                  </Button>
                  <label>
                    <Button 
                      className="cursor-pointer rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold shadow-lg shadow-gold/30 hover:shadow-gold/40 hover:scale-[1.02] active:scale-[0.98] transition-all" 
                      asChild
                    >
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </span>
                    </Button>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </motion.div>

                {/* Mobile: Selection toggle only */}
                <div className="flex sm:hidden items-center gap-2">
                  <Button
                    variant={selectionMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      lightHaptic();
                      setSelectionMode(!selectionMode);
                      if (selectionMode) {
                        setSelectedFiles([]);
                        setSelectedFolders([]);
                      }
                    }}
                    className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <CheckSquare className="w-4 h-4 mr-1" />
                    {selectionMode ? "Cancel" : "Select"}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Hidden file input for FAB */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />

          {/* Upload Progress */}
          <AnimatePresence>
            {uploading && (
              <UploadProgressBar 
                uploads={uploadProgressList}
                onCancel={() => {
                  setUploading(false);
                  setUploadProgressList([]);
                }}
              />
            )}
          </AnimatePresence>

          {/* Bulk Actions Bar */}
          {selectionMode && user && (
            <BulkActionsBar
              selectedFiles={selectedFiles}
              selectedFolders={selectedFolders}
              files={files}
              folders={folders}
              currentFolderId={currentFolderId}
              onClearSelection={() => {
                setSelectedFiles([]);
                setSelectedFolders([]);
              }}
              onSelectAll={() => {
                setSelectedFiles(filteredFiles.map(f => f.id));
                setSelectedFolders(filteredFolders.map(f => f.id));
              }}
              totalItems={filteredFiles.length + filteredFolders.length}
              onActionComplete={() => {
                fetchContents();
                setSelectedFiles([]);
                setSelectedFolders([]);
              }}
              userId={user.id}
            />
          )}

          {/* Breadcrumbs & Search */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-1 text-sm overflow-x-auto pb-2 sm:pb-0">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id || "root"} className="flex items-center">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-white/30 mx-1" />}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                      index === breadcrumbs.length - 1
                        ? "text-white font-medium bg-white/[0.05]"
                        : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    {index === 0 && <Home className="w-4 h-4" />}
                    {crumb.name}
                  </motion.button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-11 rounded-xl bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-gold/50 focus:ring-gold/20 transition-all"
                />
              </div>
              <div className="flex items-center rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.08]">
                <motion.button
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    lightHaptic();
                    setViewMode("grid");
                  }}
                  className={`p-2.5 transition-all ${
                    viewMode === "grid" ? "bg-white/[0.08] text-gold" : "text-white/40"
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    lightHaptic();
                    setViewMode("list");
                  }}
                  className={`p-2.5 transition-all ${
                    viewMode === "list" ? "bg-white/[0.08] text-gold" : "text-white/40"
                  }`}
                >
                  <List className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-10 h-10 text-gold" />
              </motion.div>
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8"
            >
              {/* Upload Zone as Empty State */}
              <UploadZone 
                onFilesSelected={processFileUpload}
                disabled={uploading}
                className="min-h-[280px]"
              />
              
              {/* Create Folder Option */}
              <div className="mt-6 text-center">
                <p className="text-white/40 text-sm mb-4">or start organizing</p>
                <Button 
                  variant="outline" 
                  onClick={() => setCreateFolderOpen(true)}
                  className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create a Folder
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                  : "space-y-2"
              }
            >
              {/* Folders */}
              {filteredFolders.map((folder) => {
                const isFolderSelected = selectedFolders.includes(folder.id);
                
                const handleFolderClick = () => {
                  if (selectionMode) {
                    lightHaptic();
                    if (isFolderSelected) {
                      setSelectedFolders(selectedFolders.filter(id => id !== folder.id));
                    } else {
                      setSelectedFolders([...selectedFolders, folder.id]);
                    }
                  } else {
                    handleNavigateToFolder(folder.id, folder.name);
                  }
                };
                
                return (
                  <motion.div
                    key={folder.id}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFolderClick}
                    className={`relative group cursor-pointer ${
                      viewMode === "grid"
                        ? "p-4 rounded-2xl bg-white/[0.02] border transition-all backdrop-blur-sm hover:bg-white/[0.04]"
                        : "flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border transition-all backdrop-blur-sm hover:bg-white/[0.04]"
                    } ${
                      isFolderSelected 
                        ? "border-gold/50 bg-gold/5 shadow-lg shadow-gold/10" 
                        : "border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    {/* Selection Checkbox */}
                    {selectionMode && (
                      <div 
                        className={viewMode === "grid" ? "absolute top-3 left-3 z-10" : "flex-shrink-0"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isFolderSelected}
                          onCheckedChange={() => handleFolderClick()}
                          className="border-white/20 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                      </div>
                    )}
                    <div
                      className={
                        viewMode === "grid"
                          ? "w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-3 mx-auto border border-amber-500/20"
                          : "w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 border border-amber-500/20"
                      }
                    >
                      <FolderOpen className="w-7 h-7 text-amber-400" />
                    </div>
                    <div className={viewMode === "grid" ? "text-center" : "flex-1 min-w-0"}>
                      <p className="font-medium text-white truncate text-sm">{folder.name}</p>
                    </div>
                    {!selectionMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                              viewMode === "grid" ? "absolute top-2 right-2" : ""
                            } text-white/40 hover:text-white hover:bg-white/10`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-black/90 backdrop-blur-xl border-white/10">
                          <DropdownMenuItem
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToShare(folder);
                              setShareFolderOpen(true);
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({ type: "folder", id: folder.id, name: folder.name });
                              setNewName(folder.name);
                              setRenameDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10" />
                          <DropdownMenuItem
                            className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolderToDelete(folder);
                              setDeleteFolderConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </motion.div>
                );
              })}

              {/* Files */}
              {filteredFiles.map((file) => {
                const IconComponent = getFileIconComponent(file.mime_type);
                const isSelected = selectedFiles.includes(file.id);
                
                const handleFileClick = () => {
                  if (selectionMode) {
                    lightHaptic();
                    if (isSelected) {
                      setSelectedFiles(selectedFiles.filter(id => id !== file.id));
                    } else {
                      setSelectedFiles([...selectedFiles, file.id]);
                    }
                  } else {
                    setPreviewFile(file);
                    setPreviewOpen(true);
                  }
                };
                
                // Get gradient based on file type
                const getFileGradient = (mimeType: string) => {
                  if (mimeType.startsWith("image/")) return "from-pink-500/20 to-rose-500/20 border-pink-500/20";
                  if (mimeType.startsWith("video/")) return "from-violet-500/20 to-purple-500/20 border-violet-500/20";
                  if (mimeType.startsWith("audio/")) return "from-green-500/20 to-emerald-500/20 border-green-500/20";
                  if (mimeType === "application/pdf") return "from-red-500/20 to-orange-500/20 border-red-500/20";
                  if (mimeType.includes("zip") || mimeType.includes("rar")) return "from-yellow-500/20 to-amber-500/20 border-yellow-500/20";
                  return "from-cyan-500/20 to-blue-500/20 border-cyan-500/20";
                };

                const getFileIconColor = (mimeType: string) => {
                  if (mimeType.startsWith("image/")) return "text-pink-400";
                  if (mimeType.startsWith("video/")) return "text-violet-400";
                  if (mimeType.startsWith("audio/")) return "text-green-400";
                  if (mimeType === "application/pdf") return "text-red-400";
                  if (mimeType.includes("zip") || mimeType.includes("rar")) return "text-yellow-400";
                  return "text-cyan-400";
                };
                
                return (
                  <motion.div
                    key={file.id}
                    variants={staggerItem}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleFileClick}
                    className={`relative group cursor-pointer ${
                      viewMode === "grid"
                        ? "p-4 rounded-2xl bg-white/[0.02] border transition-all backdrop-blur-sm hover:bg-white/[0.04]"
                        : "flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border transition-all backdrop-blur-sm hover:bg-white/[0.04]"
                    } ${
                      isSelected 
                        ? "border-gold/50 bg-gold/5 shadow-lg shadow-gold/10" 
                        : "border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    {/* Selection Checkbox */}
                    {selectionMode && (
                      <div 
                        className={viewMode === "grid" ? "absolute top-3 left-3 z-10" : "flex-shrink-0"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleFileClick()}
                          className="border-white/20 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                      </div>
                    )}
                    {/* Thumbnail with LazyImage for images/videos */}
                    {file.mime_type.startsWith("image/") || file.mime_type.startsWith("video/") ? (
                      <div
                        className={`overflow-hidden ${
                          viewMode === "grid"
                            ? "w-full aspect-square rounded-xl mb-3 mx-auto"
                            : "w-12 h-12 rounded-xl flex-shrink-0"
                        }`}
                      >
                        <LazyImage
                          src={file.thumbnail_url || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(file.storage_path)}&action=get`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          aspectRatio="square"
                          placeholderColor={file.mime_type.startsWith("image/") ? "rgba(236,72,153,0.1)" : "rgba(139,92,246,0.1)"}
                        />
                        {/* Video play indicator */}
                        {file.mime_type.startsWith("video/") && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                              <FileVideo className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`bg-gradient-to-br ${getFileGradient(file.mime_type)} border ${
                          viewMode === "grid"
                            ? "w-14 h-14 rounded-xl flex items-center justify-center mb-3 mx-auto"
                            : "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        }`}
                      >
                        <IconComponent className={`w-7 h-7 ${getFileIconColor(file.mime_type)}`} />
                      </div>
                    )}
                    <div className={viewMode === "grid" ? "text-center" : "flex-1 min-w-0"}>
                      <p className="font-medium text-white truncate text-sm">{file.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">{formatFileSize(file.size_bytes)}</p>
                    </div>
                    {!selectionMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                              viewMode === "grid" ? "absolute top-2 right-2" : ""
                            } text-white/40 hover:text-white hover:bg-white/10`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-black/90 backdrop-blur-xl border-white/10">
                          <DropdownMenuItem 
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewFile(file);
                              setPreviewOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareFile({ id: file.id, name: file.original_name });
                              setShareDialogOpen(true);
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-white/70 hover:text-white focus:text-white focus:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget({ type: "file", id: file.id, name: file.name });
                              setNewName(file.name);
                              setRenameDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/10" />
                          <DropdownMenuItem
                            className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Move to Trash
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Create Folder Dialog */}
          <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
            <DialogContent className="bg-black/95 backdrop-blur-2xl border-white/10 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-white font-outfit">Create New Folder</DialogTitle>
                <DialogDescription className="text-white/50">Enter a name for your new folder</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="folderName" className="text-white/70">Folder Name</Label>
                <Input
                  id="folderName"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My Folder"
                  className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-gold/50 rounded-xl"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCreateFolderOpen(false)}
                  className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateFolder}
                  className="rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold"
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Rename Dialog */}
          <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
            <DialogContent className="bg-black/95 backdrop-blur-2xl border-white/10 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-white font-outfit">Rename {renameTarget?.type}</DialogTitle>
                <DialogDescription className="text-white/50">Enter a new name</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="newName" className="text-white/70">New Name</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-2 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-gold/50 rounded-xl"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setRenameDialogOpen(false)}
                  className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleRename}
                  className="rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold"
                >
                  Rename
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Share Dialog */}
          {shareFile && (
            <ShareDialog
              open={shareDialogOpen}
              onOpenChange={setShareDialogOpen}
              fileId={shareFile.id}
              fileName={shareFile.name}
            />
          )}

          {/* File Preview Modal */}
          <FilePreviewModal
            file={previewFile}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
          />

          {/* Delete Folder Confirmation */}
          <Dialog open={deleteFolderConfirmOpen} onOpenChange={setDeleteFolderConfirmOpen}>
            <DialogContent className="bg-black/95 backdrop-blur-2xl border-white/10 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-white font-outfit">Delete Folder</DialogTitle>
                <DialogDescription className="text-white/50">
                  Are you sure you want to delete "{folderToDelete?.name}"? The folder must be empty to delete.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteFolderConfirmOpen(false)}
                  className="rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (folderToDelete) {
                      handleDeleteFolder(folderToDelete.id);
                      setDeleteFolderConfirmOpen(false);
                      setFolderToDelete(null);
                    }
                  }}
                  className="rounded-xl bg-red-500/80 hover:bg-red-500 text-white"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Share Folder Dialog */}
          {folderToShare && user && (
            <ShareFolderDialog
              open={shareFolderOpen}
              onOpenChange={setShareFolderOpen}
              folder={{ id: folderToShare.id, name: folderToShare.name }}
              userId={user.id}
            />
          )}
        </div>

        {/* Mobile FAB */}
        {isMobile && (
          <UploadFAB
            onUploadClick={() => fileInputRef.current?.click()}
            onNewFolderClick={() => setCreateFolderOpen(true)}
          />
        )}
      </PageTransition>
    </DashboardLayout>
  );
};

export default FileManager;

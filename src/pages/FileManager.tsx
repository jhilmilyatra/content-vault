import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  uploadFile,
  deleteFile,
  createFolder,
  renameFile,
  renameFolder,
  deleteFolder,
  getFileUrl,
  formatFileSize,
  type FileItem,
  type FolderItem,
  type UploadProgress,
} from "@/lib/fileService";
import UploadProgressBar from "@/components/files/UploadProgressBar";
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

  const { user } = useAuth();
  const { toast } = useToast();

  const fetchContents = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch folders - handle null parent_id properly
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

      // Fetch files - handle null folder_id properly
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
      // Don't show error toast for empty results
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
    
    // Initialize progress list for all files
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
      const results: FileItem[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const result = await uploadFile(file, user.id, currentFolderId, (progress) => {
          if (typeof progress === 'object') {
            setUploadProgressList((prev) => {
              const updated = [...prev];
              updated[i] = progress;
              return updated;
            });
          }
        });
        results.push(result);
      }

      toast({
        title: "Success",
        description: `${fileList.length} file(s) uploaded successfully`,
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
      // Keep progress visible for a moment after completion
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
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
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
      // Get auth session for authenticated request
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      // Fetch file via edge function with auth header
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

      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);

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

  return (
    <DashboardLayout>
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
              className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center backdrop-blur-sm"
            >
              <div className="text-center">
                <Upload className="w-16 h-16 text-primary mx-auto mb-4" />
                <p className="text-xl font-semibold text-foreground">Drop files here</p>
                <p className="text-muted-foreground">Release to upload your files</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Files</h1>
            <p className="text-muted-foreground">Manage your files and folders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) {
                  setSelectedFiles([]);
                  setSelectedFolders([]);
                }
              }}
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {selectionMode ? "Cancel" : "Select"}
            </Button>
            <Button variant="outline" onClick={() => setCreateFolderOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
            <label>
              <Button variant="hero" className="cursor-pointer" asChild>
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
          </div>
        </div>

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || "root"} className="flex items-center">
                {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors ${
                    index === breadcrumbs.length - 1
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {index === 0 && <Home className="w-4 h-4" />}
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No files yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload files or create a folder to get started
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                : "space-y-2"
            }
          >
            {/* Folders */}
            {filteredFolders.map((folder, index) => {
              const isFolderSelected = selectedFolders.includes(folder.id);
              
              const handleFolderClick = () => {
                if (selectionMode) {
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={handleFolderClick}
                  className={`relative ${
                    viewMode === "grid"
                      ? "p-4 rounded-xl bg-card border transition-all cursor-pointer group"
                      : "flex items-center gap-4 p-3 rounded-lg bg-card border transition-all cursor-pointer group"
                  } ${
                    isFolderSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div 
                      className={viewMode === "grid" ? "absolute top-2 left-2" : "flex-shrink-0"}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isFolderSelected}
                        onCheckedChange={() => handleFolderClick()}
                      />
                    </div>
                  )}
                  <div
                    className={
                      viewMode === "grid"
                        ? "w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3 mx-auto"
                        : "w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0"
                    }
                  >
                    <FolderOpen className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className={viewMode === "grid" ? "text-center" : "flex-1 min-w-0"}>
                    <p className="font-medium text-foreground truncate">{folder.name}</p>
                  </div>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                            viewMode === "grid" ? "absolute top-2 right-2" : ""
                          }`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
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
            {filteredFiles.map((file, index) => {
              const IconComponent = getFileIconComponent(file.mime_type);
              const isSelected = selectedFiles.includes(file.id);
              
              const handleFileClick = () => {
                if (selectionMode) {
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
              
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (filteredFolders.length + index) * 0.03 }}
                  onClick={handleFileClick}
                  className={`${
                    viewMode === "grid"
                      ? "relative p-4 rounded-xl bg-card border transition-all group"
                      : "flex items-center gap-4 p-3 rounded-lg bg-card border transition-all group"
                  } ${
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/30"
                  } ${selectionMode ? "cursor-pointer" : ""}`}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div 
                      className={viewMode === "grid" ? "absolute top-2 left-2" : "flex-shrink-0"}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleFileClick()}
                      />
                    </div>
                  )}
                  <div
                    className={
                      viewMode === "grid"
                        ? "w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-3 mx-auto"
                        : "w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0"
                    }
                  >
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <div className={viewMode === "grid" ? "text-center" : "flex-1 min-w-0"}>
                    <p className="font-medium text-foreground truncate text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size_bytes)}</p>
                  </div>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                            viewMode === "grid" ? "absolute top-2 right-2" : ""
                          }`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          setPreviewFile(file);
                          setPreviewOpen(true);
                        }}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setShareFile({ id: file.id, name: file.original_name });
                            setShareDialogOpen(true);
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget({ type: "file", id: file.id, name: file.name });
                            setNewName(file.name);
                            setRenameDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteFile(file)}
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
          </div>
        )}

        {/* Create Folder Dialog */}
        <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>Enter a name for your new folder</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="My Folder"
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename {renameTarget?.type}</DialogTitle>
              <DialogDescription>Enter a new name</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="newName">New Name</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRename}>Rename</Button>
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

        {/* Delete Folder Confirmation Dialog */}
        <Dialog open={deleteFolderConfirmOpen} onOpenChange={setDeleteFolderConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{folderToDelete?.name}"? The folder must be empty to be deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteFolderConfirmOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={async () => {
                  if (folderToDelete) {
                    await handleDeleteFolder(folderToDelete.id);
                    setDeleteFolderConfirmOpen(false);
                    setFolderToDelete(null);
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Guest Folder Share Dialog */}
        {user && (
          <ShareFolderDialog
            open={shareFolderOpen}
            onOpenChange={setShareFolderOpen}
            folder={folderToShare}
            userId={user.id}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FileManager;

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  restoreFile,
  permanentDeleteFile,
  formatFileSize,
  type FileItem,
} from "@/lib/fileService";
import {
  FileVideo,
  FileImage,
  FileText,
  FileArchive,
  FileAudio,
  File,
  Trash2,
  RotateCcw,
  Search,
  Loader2,
  AlertTriangle,
  CheckSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, formatDistanceToNow } from "date-fns";

const TrashBin = () => {
  const [deletedFiles, setDeletedFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const fetchDeletedFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setDeletedFiles((data as FileItem[]) || []);
    } catch (error) {
      console.error("Error fetching deleted files:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDeletedFiles();
  }, [fetchDeletedFiles]);

  const handleRestore = async (file: FileItem) => {
    try {
      await restoreFile(file.id);
      toast({ title: "File restored", description: `${file.name} has been restored` });
      fetchDeletedFiles();
    } catch (error) {
      console.error("Error restoring file:", error);
      toast({
        title: "Error",
        description: "Failed to restore file",
        variant: "destructive",
      });
    }
  };

  const handlePermanentDelete = async (file: FileItem) => {
    try {
      await permanentDeleteFile(file.id, file.storage_path);
      toast({ title: "File deleted", description: `${file.name} has been permanently deleted` });
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      fetchDeletedFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleBulkRestore = async () => {
    try {
      for (const fileId of selectedFiles) {
        await restoreFile(fileId);
      }
      toast({ title: "Files restored", description: `${selectedFiles.length} files have been restored` });
      setSelectedFiles([]);
      setSelectionMode(false);
      fetchDeletedFiles();
    } catch (error) {
      console.error("Error restoring files:", error);
      toast({
        title: "Error",
        description: "Failed to restore some files",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const fileId of selectedFiles) {
        const file = deletedFiles.find((f) => f.id === fileId);
        if (file) {
          await permanentDeleteFile(file.id, file.storage_path);
        }
      }
      toast({ title: "Files deleted", description: `${selectedFiles.length} files have been permanently deleted` });
      setSelectedFiles([]);
      setSelectionMode(false);
      setDeleteDialogOpen(false);
      fetchDeletedFiles();
    } catch (error) {
      console.error("Error deleting files:", error);
      toast({
        title: "Error",
        description: "Failed to delete some files",
        variant: "destructive",
      });
    }
  };

  const handleEmptyTrash = async () => {
    try {
      for (const file of deletedFiles) {
        await permanentDeleteFile(file.id, file.storage_path);
      }
      toast({ title: "Trash emptied", description: "All files have been permanently deleted" });
      setEmptyTrashDialogOpen(false);
      fetchDeletedFiles();
    } catch (error) {
      console.error("Error emptying trash:", error);
      toast({
        title: "Error",
        description: "Failed to empty trash",
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

  const filteredFiles = deletedFiles.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFileSelection = (fileId: string) => {
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter((id) => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trash Bin</h1>
            <p className="text-muted-foreground">Restore or permanently delete files</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) setSelectedFiles([]);
              }}
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {selectionMode ? "Cancel" : "Select"}
            </Button>
            {deletedFiles.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setEmptyTrashDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Empty Trash
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectionMode && selectedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-card border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles(filteredFiles.map((f) => f.id))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                >
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleBulkRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Forever
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deleted files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Trash is empty</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "No deleted files match your search" : "No deleted files"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map((file, index) => {
              const IconComponent = getFileIconComponent(file.mime_type);
              const isSelected = selectedFiles.includes(file.id);
              const deletedDate = file.deleted_at ? new Date(file.deleted_at) : null;

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-4 p-4 rounded-xl bg-card border transition-all group ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  {selectionMode && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                    />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size_bytes)} • Deleted{" "}
                      {deletedDate
                        ? formatDistanceToNow(deletedDate, { addSuffix: true })
                        : "unknown"}
                    </p>
                  </div>
                  {!selectionMode && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(file)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setFileToDelete(file);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Permanently Delete?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedFiles.length > 0
                  ? `This will permanently delete ${selectedFiles.length} file(s). This action cannot be undone.`
                  : fileToDelete
                  ? `This will permanently delete "${fileToDelete.name}". This action cannot be undone.`
                  : "This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (selectedFiles.length > 0) {
                    handleBulkDelete();
                  } else if (fileToDelete) {
                    handlePermanentDelete(fileToDelete);
                  }
                }}
              >
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Empty Trash Confirmation Dialog */}
        <AlertDialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Empty Trash?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {deletedFiles.length} file(s) in the trash. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleEmptyTrash}
              >
                Empty Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default TrashBin;

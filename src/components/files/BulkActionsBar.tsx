import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Trash2, FolderInput, Share2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FileItem, FolderItem } from "@/lib/fileService";
import { deleteFile } from "@/lib/fileService";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedFiles: string[];
  selectedFolders: string[];
  files: FileItem[];
  folders: FolderItem[];
  currentFolderId: string | null;
  onClearSelection: () => void;
  onSelectAll: () => void;
  totalItems: number;
  onActionComplete: () => void;
  userId: string;
}

const BulkActionsBar = ({
  selectedFiles,
  selectedFolders,
  files,
  folders,
  currentFolderId,
  onClearSelection,
  onSelectAll,
  totalItems,
  onActionComplete,
  userId,
}: BulkActionsBarProps) => {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string>("root");
  const [loading, setLoading] = useState(false);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);

  const selectedFileCount = selectedFiles.length;
  const selectedFolderCount = selectedFolders.length;
  const selectedCount = selectedFileCount + selectedFolderCount;

  const handleBulkDelete = async () => {
    if (!selectedCount) return;
    
    setLoading(true);
    try {
      // Delete selected files
      const selectedFileItems = files.filter(f => selectedFiles.includes(f.id));
      for (const file of selectedFileItems) {
        await deleteFile(file.id, file.storage_path);
      }
      
      // Delete selected folders
      for (const folderId of selectedFolders) {
        const { error } = await supabase
          .from("folders")
          .delete()
          .eq("id", folderId);
        if (error) throw error;
      }
      
      const message = [];
      if (selectedFileCount > 0) message.push(`${selectedFileCount} file(s) moved to trash`);
      if (selectedFolderCount > 0) message.push(`${selectedFolderCount} folder(s) deleted`);
      
      toast.success(message.join(", "));
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete some items. Folders must be empty to delete.");
    } finally {
      setLoading(false);
    }
  };

  const openMoveDialog = async () => {
    // Fetch all folders for the user
    const { data } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    
    setAllFolders(data as FolderItem[] || []);
    setMoveDialogOpen(true);
  };

  const handleBulkMove = async () => {
    if (!selectedCount) return;
    
    setLoading(true);
    try {
      const newFolderId = targetFolderId === "root" ? null : targetFolderId;
      
      const { error } = await supabase
        .from("files")
        .update({ folder_id: newFolderId })
        .in("id", selectedFiles);
      
      if (error) throw error;
      
      toast.success(`${selectedCount} file(s) moved`);
      setMoveDialogOpen(false);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk move error:", error);
      toast.error("Failed to move files");
    } finally {
      setLoading(false);
    }
  };

  const generateShortCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleBulkShare = async () => {
    if (!selectedCount) return;
    
    setLoading(true);
    try {
      const links = [];
      
      for (const fileId of selectedFiles) {
        const shortCode = generateShortCode();
        const { error } = await supabase
          .from("shared_links")
          .insert({
            file_id: fileId,
            user_id: userId,
            short_code: shortCode,
          });
        
        if (error) throw error;
        links.push(`${window.location.origin}/share/${shortCode}`);
      }
      
      // Copy all links to clipboard
      await navigator.clipboard.writeText(links.join("\n"));
      
      toast.success(`${selectedCount} share link(s) created and copied to clipboard`);
      setShareDialogOpen(false);
      onClearSelection();
    } catch (error) {
      console.error("Bulk share error:", error);
      toast.error("Failed to create share links");
    } finally {
      setLoading(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 30 
          }}
          className={cn(
            "fixed bottom-24 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-24",
            "sm:max-w-md",
            "p-3 rounded-2xl",
            "glass-elevated",
            "safe-area-bottom"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCount === totalItems}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectAll();
                    } else {
                      onClearSelection();
                    }
                  }}
                  className="border-muted-foreground/50"
                />
                <span className="text-sm font-medium text-foreground">
                  {selectedCount} selected
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 px-2 text-muted-foreground hover:text-foreground press-scale"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareDialogOpen(true)}
                disabled={loading || selectedFileCount === 0}
                className="h-9 w-9 rounded-xl press-scale"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={openMoveDialog}
                disabled={loading || selectedFileCount === 0}
                className="h-9 w-9 rounded-xl press-scale"
                title="Move"
              >
                <FolderInput className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBulkDelete}
                disabled={loading}
                className="h-9 w-9 rounded-xl press-scale text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Move Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedCount} file(s)</DialogTitle>
            <DialogDescription>
              Select a destination folder
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={targetFolderId} onValueChange={setTargetFolderId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">My Files (Root)</SelectItem>
                {allFolders
                  .filter(f => f.id !== currentFolderId)
                  .map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleBulkMove} disabled={loading} className="rounded-xl">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Move Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Confirmation Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {selectedFileCount} file(s)</DialogTitle>
            <DialogDescription>
              Create share links for all selected files. Links will be copied to your clipboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleBulkShare} disabled={loading} className="rounded-xl">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Links
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkActionsBar;
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

interface BulkActionsBarProps {
  selectedFiles: string[];
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

  const selectedCount = selectedFiles.length;

  const handleBulkDelete = async () => {
    if (!selectedCount) return;
    
    setLoading(true);
    try {
      const selectedFileItems = files.filter(f => selectedFiles.includes(f.id));
      
      for (const file of selectedFileItems) {
        await deleteFile(file.id, file.storage_path);
      }
      
      toast.success(`${selectedCount} file(s) moved to trash`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete some files");
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
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30"
        >
          <div className="flex items-center gap-4">
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
              />
              <span className="text-sm font-medium">
                {selectedCount} selected
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
              disabled={loading}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openMoveDialog}
              disabled={loading}
            >
              <FolderInput className="w-4 h-4 mr-2" />
              Move
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
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
              <SelectTrigger>
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
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkMove} disabled={loading}>
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
            <DialogTitle>Share {selectedCount} file(s)</DialogTitle>
            <DialogDescription>
              Create share links for all selected files. Links will be copied to your clipboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkShare} disabled={loading}>
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

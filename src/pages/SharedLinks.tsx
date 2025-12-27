import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Link2,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  Download,
  Eye,
  Loader2,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SharedLink {
  id: string;
  file_id: string;
  short_code: string;
  password_hash: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  is_active: boolean;
  created_at: string;
  file_name?: string;
}

const SharedLinks = () => {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<SharedLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    isActive: true,
    useExpiration: false,
    expirationDays: "7",
    useMaxDownloads: false,
    maxDownloads: "10",
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchLinks();
  }, [user]);

  const fetchLinks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch shared links
      const { data: linksData, error: linksError } = await supabase
        .from("shared_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (linksError) throw linksError;

      // Fetch file names for each link
      const fileIds = [...new Set(linksData?.map(l => l.file_id) || [])];
      const { data: filesData } = await supabase
        .from("files")
        .select("id, original_name")
        .in("id", fileIds);

      const linksWithFiles = (linksData || []).map(link => ({
        ...link,
        file_name: filesData?.find(f => f.id === link.file_id)?.original_name || "Unknown file"
      }));

      setLinks(linksWithFiles);
    } catch (error) {
      console.error("Error fetching links:", error);
      toast({
        title: "Error",
        description: "Failed to fetch share links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (link: SharedLink) => {
    const url = `${window.location.origin}/share/${link.short_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedId(link.id);
        toast({ title: "Link copied to clipboard" });
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) {
        toast({
          title: "Failed to copy",
          description: "Please copy the link manually",
          variant: "destructive",
        });
      }
      document.body.removeChild(textArea);
    }
  };

  const openEditDialog = (link: SharedLink) => {
    setSelectedLink(link);
    setEditForm({
      isActive: link.is_active,
      useExpiration: !!link.expires_at,
      expirationDays: "7",
      useMaxDownloads: !!link.max_downloads,
      maxDownloads: link.max_downloads?.toString() || "10",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateLink = async () => {
    if (!selectedLink) return;

    try {
      const updates: Record<string, unknown> = {
        is_active: editForm.isActive,
      };

      if (editForm.useExpiration) {
        const days = parseInt(editForm.expirationDays);
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        updates.expires_at = expDate.toISOString();
      } else {
        updates.expires_at = null;
      }

      if (editForm.useMaxDownloads) {
        updates.max_downloads = parseInt(editForm.maxDownloads);
      } else {
        updates.max_downloads = null;
      }

      const { error } = await supabase
        .from("shared_links")
        .update(updates)
        .eq("id", selectedLink.id);

      if (error) throw error;

      toast({ title: "Link updated successfully" });
      setEditDialogOpen(false);
      fetchLinks();
    } catch (error) {
      console.error("Error updating link:", error);
      toast({
        title: "Error",
        description: "Failed to update link",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;

    try {
      const { error } = await supabase
        .from("shared_links")
        .delete()
        .eq("id", selectedLink.id);

      if (error) throw error;

      toast({ title: "Link deleted" });
      setDeleteDialogOpen(false);
      setSelectedLink(null);
      fetchLinks();
    } catch (error) {
      console.error("Error deleting link:", error);
      toast({
        title: "Error",
        description: "Failed to delete link",
        variant: "destructive",
      });
    }
  };

  const toggleLinkStatus = async (link: SharedLink) => {
    try {
      const { error } = await supabase
        .from("shared_links")
        .update({ is_active: !link.is_active })
        .eq("id", link.id);

      if (error) throw error;

      toast({ title: `Link ${link.is_active ? "disabled" : "enabled"}` });
      fetchLinks();
    } catch (error) {
      console.error("Error toggling link:", error);
      toast({
        title: "Error",
        description: "Failed to update link",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isExpired = (link: SharedLink) => {
    if (!link.expires_at) return false;
    return new Date(link.expires_at) < new Date();
  };

  const filteredLinks = links.filter(
    (link) =>
      link.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.short_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLinks = filteredLinks.filter((l) => l.is_active && !isExpired(l));
  const inactiveLinks = filteredLinks.filter((l) => !l.is_active || isExpired(l));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Link2 className="w-6 h-6 text-primary" />
              Shared Links
            </h1>
            <p className="text-muted-foreground">Manage all your file share links</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{links.length}</p>
              <p className="text-sm text-muted-foreground">Total Links</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-success">{activeLinks.length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-muted-foreground">{inactiveLinks.length}</p>
              <p className="text-sm text-muted-foreground">Inactive/Expired</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold text-foreground">
                {links.reduce((acc, l) => acc + l.download_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Downloads</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Links Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredLinks.length === 0 ? (
              <div className="text-center py-12">
                <Link2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No share links yet</h3>
                <p className="text-muted-foreground">
                  Create share links from the Files page to get started
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Protection</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{link.file_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{link.short_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isExpired(link) ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : link.is_active ? (
                            <Badge className="bg-success/20 text-success border-success/30">Active</Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {link.password_hash ? (
                              <div className="flex items-center gap-1 text-xs">
                                <Lock className="w-3 h-3" />
                                Password
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Unlock className="w-3 h-3" />
                                None
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Download className="w-3 h-3 text-muted-foreground" />
                            {link.download_count}
                            {link.max_downloads && (
                              <span className="text-muted-foreground">/ {link.max_downloads}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {link.expires_at ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="w-3 h-3" />
                              {formatDate(link.expires_at)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(link.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(link)}
                            >
                              {copiedId === link.id ? (
                                <Check className="w-4 h-4 text-success" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/share/${link.short_code}`, "_blank")}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(link)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleLinkStatus(link)}>
                                  {link.is_active ? (
                                    <>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Disable Link
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Enable Link
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedLink(link);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Link
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Link Settings</DialogTitle>
              <DialogDescription>
                Update settings for "{selectedLink?.file_name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Link Active</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable this link</p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Link Expiration</Label>
                  <p className="text-sm text-muted-foreground">Set a new expiration date</p>
                </div>
                <Switch
                  checked={editForm.useExpiration}
                  onCheckedChange={(v) => setEditForm({ ...editForm, useExpiration: v })}
                />
              </div>
              {editForm.useExpiration && (
                <Select
                  value={editForm.expirationDays}
                  onValueChange={(v) => setEditForm({ ...editForm, expirationDays: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day from now</SelectItem>
                    <SelectItem value="7">7 days from now</SelectItem>
                    <SelectItem value="30">30 days from now</SelectItem>
                    <SelectItem value="90">90 days from now</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Download Limit</Label>
                  <p className="text-sm text-muted-foreground">Set max downloads</p>
                </div>
                <Switch
                  checked={editForm.useMaxDownloads}
                  onCheckedChange={(v) => setEditForm({ ...editForm, useMaxDownloads: v })}
                />
              </div>
              {editForm.useMaxDownloads && (
                <Select
                  value={editForm.maxDownloads}
                  onValueChange={(v) => setEditForm({ ...editForm, maxDownloads: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 downloads</SelectItem>
                    <SelectItem value="10">10 downloads</SelectItem>
                    <SelectItem value="25">25 downloads</SelectItem>
                    <SelectItem value="50">50 downloads</SelectItem>
                    <SelectItem value="100">100 downloads</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLink}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Share Link</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this share link? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteLink}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SharedLinks;

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  Link2,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  ExternalLink,
  Lock,
  Unlock,
  Download,
  Loader2,
  Check,
  Users,
  Send,
  Ban,
  MessageCircle,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

interface GuestUser {
  id: string;
  email: string;
  full_name: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  folders: string[];
  unread_messages: number;
}

const Sharing = () => {
  const [activeTab, setActiveTab] = useState("links");
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<SharedLink | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch share links
  const fetchLinks = useCallback(async () => {
    if (!user) return;

    try {
      const { data: linksData, error: linksError } = await supabase
        .from("shared_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (linksError) throw linksError;

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
    }
  }, [user]);

  // Fetch guests
  const fetchGuests = useCallback(async () => {
    if (!user) return;

    try {
      const { data: accessData } = await supabase
        .from('guest_folder_access')
        .select(`
          guest_id,
          folder_share:folder_shares(folder:folders(name))
        `)
        .eq('member_id', user.id);

      const guestFolderMap = new Map<string, string[]>();
      (accessData || []).forEach((access) => {
        const guestId = access.guest_id;
        const folderName = (access.folder_share as any)?.folder?.name || 'Unknown';
        if (!guestFolderMap.has(guestId)) {
          guestFolderMap.set(guestId, []);
        }
        guestFolderMap.get(guestId)!.push(folderName);
      });

      const guestIds = [...guestFolderMap.keys()];
      if (guestIds.length > 0) {
        const { data: guestData } = await supabase
          .from('guest_users')
          .select('*')
          .in('id', guestIds);

        const guestList: GuestUser[] = await Promise.all(
          (guestData || []).map(async (g) => {
            const { count } = await supabase
              .from('guest_messages')
              .select('id', { count: 'exact', head: true })
              .eq('guest_id', g.id)
              .eq('member_id', user.id)
              .eq('sender_type', 'guest')
              .eq('is_read', false);

            return {
              id: g.id,
              email: g.email,
              full_name: g.full_name,
              is_banned: g.is_banned,
              ban_reason: g.ban_reason,
              created_at: g.created_at,
              folders: guestFolderMap.get(g.id) || [],
              unread_messages: count || 0,
            };
          })
        );

        setGuests(guestList);
      }
    } catch (error) {
      console.error("Error fetching guests:", error);
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchLinks(), fetchGuests()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchLinks, fetchGuests]);

  const copyLink = async (link: SharedLink) => {
    const url = `${window.location.origin}/share/${link.short_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      toast({ title: "Link copied" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
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
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
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
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedGuest || !user || !messageContent.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('guest_messages').insert({
        guest_id: selectedGuest.id,
        member_id: user.id,
        sender_type: 'member',
        message: messageContent.trim(),
      });

      if (error) throw error;
      toast({ title: 'Message sent' });
      setMessageDialogOpen(false);
      setSelectedGuest(null);
      setMessageContent('');
    } catch {
      toast({ title: 'Failed to send', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleBanGuest = async (guest: GuestUser, ban: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('guest_users')
        .update({
          is_banned: ban,
          banned_at: ban ? new Date().toISOString() : null,
          banned_by: ban ? user.id : null,
          ban_reason: ban ? 'Banned by owner' : null,
        })
        .eq('id', guest.id);

      if (error) throw error;
      toast({ title: ban ? 'Guest banned' : 'Guest unbanned' });
      fetchGuests();
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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

  const filteredGuests = guests.filter(
    (g) =>
      g.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLinks = links.filter((l) => l.is_active && !isExpired(l));

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6 max-w-5xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-xl font-semibold text-foreground">Sharing</h1>
              <p className="text-sm text-muted-foreground">
                Manage links and guest access
              </p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-2xl font-semibold">{links.length}</p>
              <p className="text-xs text-muted-foreground">Total Links</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-2xl font-semibold text-emerald-500">{activeLinks.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-2xl font-semibold">{guests.length}</p>
              <p className="text-xs text-muted-foreground">Guests</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-2xl font-semibold">
                {links.reduce((acc, l) => acc + l.download_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="links" className="gap-2">
                  <Link2 className="w-4 h-4" />
                  Links
                </TabsTrigger>
                <TabsTrigger value="guests" className="gap-2">
                  <Users className="w-4 h-4" />
                  Guests
                  {guests.filter(g => g.unread_messages > 0).length > 0 && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === "links" ? "Search links..." : "Search guests..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Links Tab */}
            <TabsContent value="links" className="mt-4">
              <div className="bg-card border border-border rounded-lg">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="p-8 text-center">
                    <Link2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No links match your search" : "No share links yet"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          {link.password_hash ? (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Link2 className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{link.file_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{link.short_code}</span>
                            <span>•</span>
                            <Download className="w-3 h-3" />
                            <span>{link.download_count}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isExpired(link) ? (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          ) : link.is_active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Disabled</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyLink(link)}
                          >
                            {copiedId === link.id ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`/share/${link.short_code}`, "_blank")}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleLinkStatus(link)}>
                                {link.is_active ? (
                                  <>
                                    <EyeOff className="w-4 h-4 mr-2" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Enable
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
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Guests Tab */}
            <TabsContent value="guests" className="mt-4">
              <div className="bg-card border border-border rounded-lg">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredGuests.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "No guests match your search" : "No guests with folder access"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredGuests.map((guest) => (
                      <div
                        key={guest.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-medium text-sm">
                          {(guest.full_name || guest.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {guest.full_name || guest.email}
                            </p>
                            {guest.unread_messages > 0 && (
                              <span className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {guest.folders.slice(0, 2).join(", ")}
                            {guest.folders.length > 2 && ` +${guest.folders.length - 2}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {guest.is_banned && (
                            <Badge variant="destructive" className="text-xs">Banned</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedGuest(guest);
                              setMessageDialogOpen(true);
                            }}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedGuest(guest);
                                setMessageDialogOpen(true);
                              }}>
                                <Send className="w-4 h-4 mr-2" />
                                Send Message
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className={guest.is_banned ? "" : "text-destructive"}
                                onClick={() => handleBanGuest(guest, !guest.is_banned)}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                {guest.is_banned ? "Unban" : "Ban Guest"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Delete Link Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Link</DialogTitle>
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

        {/* Message Dialog */}
        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
              <DialogDescription>
                Send a message to {selectedGuest?.full_name || selectedGuest?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Type your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendMessage} disabled={sending || !messageContent.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Sharing;

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Search,
  MoreHorizontal,
  Ban,
  UserX,
  MessageCircle,
  Loader2,
  Bell,
  Check,
  FolderOpen,
  Send,
  KeyRound,
} from 'lucide-react';

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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_guest_id: string | null;
  is_read: boolean;
  created_at: string;
}

const GuestManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [guests, setGuests] = useState<GuestUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch guest access records for this member
        const { data: accessData } = await supabase
          .from('guest_folder_access')
          .select(`
            guest_id,
            folder_share:folder_shares(folder:folders(name))
          `)
          .eq('member_id', user.id);

        // Group by guest and collect folder names
        const guestFolderMap = new Map<string, string[]>();
        (accessData || []).forEach((access) => {
          const guestId = access.guest_id;
          const folderName = (access.folder_share as any)?.folder?.name || 'Unknown';
          if (!guestFolderMap.has(guestId)) {
            guestFolderMap.set(guestId, []);
          }
          guestFolderMap.get(guestId)!.push(folderName);
        });

        // Fetch guest user details
        const guestIds = [...guestFolderMap.keys()];
        if (guestIds.length > 0) {
          const { data: guestData } = await supabase
            .from('guest_users')
            .select('*')
            .in('id', guestIds);

          // Get unread message counts
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

        // Fetch notifications
        const { data: notifData } = await supabase
          .from('member_notifications')
          .select('*')
          .eq('member_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        setNotifications(notifData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Real-time notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('member-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'member_notifications',
          filter: `member_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          toast({
            title: (payload.new as Notification).title,
            description: (payload.new as Notification).message || undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const handleBanGuest = async () => {
    if (!selectedGuest || !user) return;

    try {
      const { error } = await supabase
        .from('guest_users')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_by: user.id,
          ban_reason: banReason || 'Banned by folder owner',
        })
        .eq('id', selectedGuest.id);

      if (error) throw error;

      setGuests((prev) =>
        prev.map((g) =>
          g.id === selectedGuest.id
            ? { ...g, is_banned: true, ban_reason: banReason }
            : g
        )
      );

      toast({ title: 'Guest banned successfully' });
      setBanDialogOpen(false);
      setSelectedGuest(null);
      setBanReason('');
    } catch (error) {
      console.error('Error banning guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to ban guest',
        variant: 'destructive',
      });
    }
  };

  const handleUnbanGuest = async (guest: GuestUser) => {
    try {
      const { error } = await supabase
        .from('guest_users')
        .update({
          is_banned: false,
          banned_at: null,
          banned_by: null,
          ban_reason: null,
        })
        .eq('id', guest.id);

      if (error) throw error;

      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id ? { ...g, is_banned: false, ban_reason: null } : g
        )
      );

      toast({ title: 'Guest unbanned successfully' });
    } catch (error) {
      console.error('Error unbanning guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to unban guest',
        variant: 'destructive',
      });
    }
  };

  const handleRestrictAccess = async (guest: GuestUser) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('guest_folder_access')
        .update({
          is_restricted: true,
          restricted_at: new Date().toISOString(),
          restricted_by: user.id,
        })
        .eq('guest_id', guest.id)
        .eq('member_id', user.id);

      if (error) throw error;

      setGuests((prev) => prev.filter((g) => g.id !== guest.id));
      toast({ title: 'Access restricted successfully' });
    } catch (error) {
      console.error('Error restricting access:', error);
      toast({
        title: 'Error',
        description: 'Failed to restrict access',
        variant: 'destructive',
      });
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

      toast({ title: 'Message sent successfully' });
      setMessageDialogOpen(false);
      setSelectedGuest(null);
      setMessageContent('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleBroadcastMessage = async () => {
    if (!user || !messageContent.trim()) return;

    setSending(true);
    try {
      const messages = guests.map((g) => ({
        guest_id: g.id,
        member_id: user.id,
        sender_type: 'member' as const,
        message: messageContent.trim(),
      }));

      const { error } = await supabase.from('guest_messages').insert(messages);

      if (error) throw error;

      toast({ title: `Message sent to ${guests.length} guests` });
      setBroadcastDialogOpen(false);
      setMessageContent('');
    } catch (error) {
      console.error('Error broadcasting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send broadcast message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedGuest || !newPassword.trim()) return;

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-guest-password', {
        body: { guestId: selectedGuest.id, newPassword }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to reset password');

      toast({ title: 'Password reset successfully' });
      setResetPasswordDialogOpen(false);
      setSelectedGuest(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const markNotificationRead = async (notifId: string) => {
    await supabase
      .from('member_notifications')
      .update({ is_read: true })
      .eq('id', notifId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  };

  const filteredGuests = guests.filter(
    (g) =>
      g.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadNotifCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Guest Management</h1>
            <p className="text-muted-foreground">
              Manage users who have access to your shared folders
            </p>
          </div>
          <Button onClick={() => setBroadcastDialogOpen(true)} disabled={guests.length === 0}>
            <Send className="w-4 h-4 mr-2" />
            Message All Guests
          </Button>
        </div>

        <Tabs defaultValue="guests">
          <TabsList>
            <TabsTrigger value="guests" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Guests ({guests.length})
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
              {unreadNotifCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadNotifCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guests" className="mt-6">
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Guests Table */}
            {filteredGuests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No guests yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Share a folder link to invite guests
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Folders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGuests.map((guest) => (
                      <TableRow key={guest.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{guest.full_name || 'No name'}</p>
                            <p className="text-sm text-muted-foreground">{guest.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {guest.folders.slice(0, 2).map((folder, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                <FolderOpen className="w-3 h-3 mr-1" />
                                {folder}
                              </Badge>
                            ))}
                            {guest.folders.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{guest.folders.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {guest.is_banned ? (
                            <Badge variant="destructive">Banned</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {guest.unread_messages > 0 && (
                            <Badge variant="default">{guest.unread_messages} unread</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(guest.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedGuest(guest);
                                  setMessageDialogOpen(true);
                                }}
                              >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Send Message
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedGuest(guest);
                                  setResetPasswordDialogOpen(true);
                                }}
                              >
                                <KeyRound className="w-4 h-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRestrictAccess(guest)}
                              >
                                <UserX className="w-4 h-4 mr-2" />
                                Remove Access
                              </DropdownMenuItem>
                              {guest.is_banned ? (
                                <DropdownMenuItem onClick={() => handleUnbanGuest(guest)}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Unban Guest
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setSelectedGuest(guest);
                                    setBanDialogOpen(true);
                                  }}
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Ban Guest
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            {notifications.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No notifications</h3>
                  <p className="text-muted-foreground text-sm">
                    You'll see notifications when guests interact with you
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <Card
                    key={notif.id}
                    className={`cursor-pointer transition-colors ${
                      notif.is_read ? 'opacity-60' : 'border-primary/30'
                    }`}
                    onClick={() => markNotificationRead(notif.id)}
                  >
                    <CardContent className="py-4 flex items-center gap-4">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          notif.is_read ? 'bg-muted' : 'bg-primary'
                        }`}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notif.title}</p>
                        {notif.message && (
                          <p className="text-sm text-muted-foreground">{notif.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Ban Dialog */}
        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ban Guest</DialogTitle>
              <DialogDescription>
                Ban {selectedGuest?.full_name || selectedGuest?.email} from accessing your folders.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Reason for ban (optional)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBanGuest}>
                Ban Guest
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
            <div className="space-y-4 py-4">
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
                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send Message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Broadcast Dialog */}
        <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Broadcast Message</DialogTitle>
              <DialogDescription>
                Send a message to all {guests.length} guests
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Type your broadcast message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBroadcastDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBroadcastMessage} disabled={sending || !messageContent.trim()}>
                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send to All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Guest Password</DialogTitle>
              <DialogDescription>
                Set a new password for {selectedGuest?.full_name || selectedGuest?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder="New password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={sending || newPassword.length < 6}>
                {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default GuestManagement;

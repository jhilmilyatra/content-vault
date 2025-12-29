import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Search,
  MoreHorizontal,
  Ban,
  UserX,
  MessageCircle,
  Bell,
  Check,
  FolderOpen,
  Send,
  KeyRound,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassCard, GlassCardHeader } from '@/components/ios/GlassCard';
import { SkeletonList, SkeletonStats } from '@/components/ios/SkeletonLoader';
import { IosModal } from '@/components/ios/IosModal';
import { IosSheet } from '@/components/ios/IosSheet';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { lightHaptic, mediumHaptic } from '@/lib/haptics';

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
  const [banSheetOpen, setBanSheetOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [messageSheetOpen, setMessageSheetOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'guests' | 'notifications'>('guests');

  useEffect(() => {
    const fetchData = async () => {
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

    setSending(true);
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

      mediumHaptic();
      toast({ title: 'Guest banned successfully' });
      setBanSheetOpen(false);
      setSelectedGuest(null);
      setBanReason('');
    } catch (error) {
      console.error('Error banning guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to ban guest',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleUnbanGuest = async (guest: GuestUser) => {
    lightHaptic();
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
    lightHaptic();

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

      lightHaptic();
      toast({ title: 'Message sent successfully' });
      setMessageSheetOpen(false);
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

      lightHaptic();
      toast({ title: `Message sent to ${guests.length} guests` });
      setBroadcastModalOpen(false);
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

      lightHaptic();
      toast({ title: 'Password reset successfully' });
      setResetPasswordModalOpen(false);
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
    lightHaptic();
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

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6 px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl ios-glass flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Guest Management
            </h1>
            <p className="text-muted-foreground mt-1 ml-13 text-sm">
              Manage users with folder access
            </p>
          </div>
          <Button 
            onClick={() => {
              lightHaptic();
              setBroadcastModalOpen(true);
            }} 
            disabled={guests.length === 0}
            className="rounded-xl h-10 text-sm ios-press"
            size="sm"
          >
            <Send className="w-4 h-4 mr-2" />
            Broadcast
          </Button>
        </div>

        {/* iOS-style Segmented Control */}
        <div className="ios-glass rounded-xl p-1 flex animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <button
            onClick={() => {
              lightHaptic();
              setActiveTab('guests');
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'guests'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            Guests ({guests.length})
          </button>
          <button
            onClick={() => {
              lightHaptic();
              setActiveTab('notifications');
            }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'notifications'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
            {unreadNotifCount > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'guests' ? (
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search guests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 rounded-2xl ios-glass border-0 text-base"
              />
            </div>

            {/* Guests List */}
            <GlassCard variant="elevated">
              <GlassCardHeader
                title={`All Guests (${filteredGuests.length})`}
                icon={<Users className="w-5 h-5" />}
              />
              
              <div className="p-4">
                {loading ? (
                  <SkeletonList />
                ) : filteredGuests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No guests yet</p>
                    <p className="text-sm mt-1">Share a folder link to invite guests</p>
                  </div>
                ) : (
                  <motion.div 
                    className="space-y-2"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {filteredGuests.map((guest) => (
                      <motion.div
                        key={guest.id}
                        variants={staggerItem}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                          guest.is_banned
                            ? 'bg-destructive/10 border border-destructive/20'
                            : 'ios-glass-subtle hover:bg-muted/30'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                          {guest.full_name?.[0]?.toUpperCase() || guest.email[0]?.toUpperCase()}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {guest.full_name || 'No name'}
                            </p>
                            {guest.is_banned && (
                              <Badge variant="destructive" className="text-xs rounded-full px-2">
                                Banned
                              </Badge>
                            )}
                            {guest.unread_messages > 0 && (
                              <Badge className="text-xs rounded-full px-2">
                                {guest.unread_messages} new
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {guest.email}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {guest.folders.slice(0, 2).map((folder, i) => (
                              <span 
                                key={i} 
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full"
                              >
                                <FolderOpen className="w-3 h-3" />
                                {folder}
                              </span>
                            ))}
                            {guest.folders.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{guest.folders.length - 2}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="rounded-full h-9 w-9 shrink-0"
                              onClick={() => lightHaptic()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="ios-glass-elevated rounded-2xl min-w-[180px]">
                            <DropdownMenuItem
                              onClick={() => {
                                lightHaptic();
                                setSelectedGuest(guest);
                                setMessageSheetOpen(true);
                              }}
                              className="rounded-xl py-3"
                            >
                              <MessageCircle className="w-4 h-4 mr-3" />
                              Send Message
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                lightHaptic();
                                setSelectedGuest(guest);
                                setResetPasswordModalOpen(true);
                              }}
                              className="rounded-xl py-3"
                            >
                              <KeyRound className="w-4 h-4 mr-3" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/30" />
                            <DropdownMenuItem
                              onClick={() => handleRestrictAccess(guest)}
                              className="rounded-xl py-3"
                            >
                              <UserX className="w-4 h-4 mr-3" />
                              Remove Access
                            </DropdownMenuItem>
                            {guest.is_banned ? (
                              <DropdownMenuItem 
                                onClick={() => handleUnbanGuest(guest)}
                                className="rounded-xl py-3 text-emerald-500"
                              >
                                <Check className="w-4 h-4 mr-3" />
                                Unban Guest
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="rounded-xl py-3 text-destructive"
                                onClick={() => {
                                  lightHaptic();
                                  setSelectedGuest(guest);
                                  setBanSheetOpen(true);
                                }}
                              >
                                <Ban className="w-4 h-4 mr-3" />
                                Ban Guest
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </GlassCard>
          </div>
        ) : (
          <div className="space-y-2 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {loading ? (
              <SkeletonList />
            ) : notifications.length === 0 ? (
              <GlassCard variant="elevated" className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="font-medium text-muted-foreground">No notifications</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll see notifications when guests interact
                </p>
              </GlassCard>
            ) : (
              <motion.div 
                className="space-y-2"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    variants={staggerItem}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => markNotificationRead(notif.id)}
                    className={`p-4 rounded-2xl ios-glass-card cursor-pointer flex items-center gap-4 ${
                      notif.is_read ? 'opacity-60' : ''
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        notif.is_read ? 'bg-muted' : 'bg-primary animate-pulse-glow'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{notif.title}</p>
                      {notif.message && (
                        <p className="text-sm text-muted-foreground truncate">{notif.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Ban Sheet */}
        <IosSheet
          open={banSheetOpen}
          onClose={() => setBanSheetOpen(false)}
          title="Ban Guest"
          description={`Ban ${selectedGuest?.full_name || selectedGuest?.email} from accessing your folders.`}
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setBanSheetOpen(false)}
                className="w-full rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBanGuest}
                disabled={sending}
                className="w-full rounded-xl h-12"
              >
                {sending ? 'Banning...' : 'Ban Guest'}
              </Button>
            </>
          }
        >
          <Textarea
            placeholder="Reason for ban (optional)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            className="rounded-xl ios-glass border-0 min-h-[100px]"
          />
        </IosSheet>

        {/* Message Sheet */}
        <IosSheet
          open={messageSheetOpen}
          onClose={() => setMessageSheetOpen(false)}
          title="Send Message"
          description={`Send a message to ${selectedGuest?.full_name || selectedGuest?.email}`}
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setMessageSheetOpen(false)}
                className="w-full rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSendMessage} 
                disabled={sending || !messageContent.trim()}
                className="w-full rounded-xl h-12"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </Button>
            </>
          }
        >
          <Textarea
            placeholder="Type your message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={4}
            className="rounded-xl ios-glass border-0 min-h-[120px]"
          />
        </IosSheet>

        {/* Broadcast Modal */}
        <IosModal
          open={broadcastModalOpen}
          onClose={() => setBroadcastModalOpen(false)}
          title="Broadcast Message"
          description={`Send a message to all ${guests.length} guests`}
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setBroadcastModalOpen(false)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBroadcastMessage} 
                disabled={sending || !messageContent.trim()}
                className="flex-1 rounded-xl h-12"
              >
                {sending ? 'Sending...' : 'Send to All'}
              </Button>
            </>
          }
        >
          <Textarea
            placeholder="Type your broadcast message..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={4}
            className="rounded-xl ios-glass border-0 min-h-[120px]"
          />
        </IosModal>

        {/* Reset Password Modal */}
        <IosModal
          open={resetPasswordModalOpen}
          onClose={() => setResetPasswordModalOpen(false)}
          title="Reset Guest Password"
          description={`Set a new password for ${selectedGuest?.full_name || selectedGuest?.email}`}
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setResetPasswordModalOpen(false)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleResetPassword} 
                disabled={sending || newPassword.length < 6}
                className="flex-1 rounded-xl h-12"
              >
                {sending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </>
          }
        >
          <Input
            type="password"
            placeholder="New password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-12 rounded-xl ios-glass border-0"
          />
        </IosModal>
      </motion.div>
    </DashboardLayout>
  );
};

export default GuestManagement;

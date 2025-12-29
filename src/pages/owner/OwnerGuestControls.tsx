import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition, staggerContainer, staggerItem } from "@/components/ui/PageTransition";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Ban, UserX, Users, Shield, RefreshCw, KeyRound, Loader2, UserCheck, FolderKey } from "lucide-react";
import { format } from "date-fns";
import { GlassCard, SkeletonStats, SkeletonTable } from "@/components/ios";

interface GuestWithAccess {
  id: string;
  email: string;
  full_name: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  member_id: string;
  member_email: string;
  member_name: string;
  folder_name: string;
  is_restricted: boolean;
}

const OwnerGuestControls = () => {
  const [guests, setGuests] = useState<GuestWithAccess[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<GuestWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<GuestWithAccess | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const fetchGuests = async () => {
    setLoading(true);
    try {
      // Fetch all guests with their folder access info
      const { data: guestAccessData, error: accessError } = await supabase
        .from("guest_folder_access")
        .select(`
          guest_id,
          member_id,
          is_restricted,
          folder_share_id,
          guest_users!inner (
            id,
            email,
            full_name,
            is_banned,
            ban_reason,
            created_at
          ),
          folder_shares!inner (
            folder_id,
            folders!inner (
              name
            )
          )
        `);

      if (accessError) throw accessError;

      // Fetch member profiles
      const memberIds = [...new Set(guestAccessData?.map(g => g.member_id) || [])];
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", memberIds);

      const memberMap = new Map(memberProfiles?.map(p => [p.user_id, p]) || []);

      const formattedGuests: GuestWithAccess[] = (guestAccessData || []).map((access: any) => {
        const member = memberMap.get(access.member_id);
        return {
          id: access.guest_users.id,
          email: access.guest_users.email,
          full_name: access.guest_users.full_name,
          is_banned: access.guest_users.is_banned,
          ban_reason: access.guest_users.ban_reason,
          created_at: access.guest_users.created_at,
          member_id: access.member_id,
          member_email: member?.email || "Unknown",
          member_name: member?.full_name || "Unknown",
          folder_name: access.folder_shares.folders.name,
          is_restricted: access.is_restricted,
        };
      });

      setGuests(formattedGuests);
      setFilteredGuests(formattedGuests);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredGuests(
        guests.filter(
          (g) =>
            g.email.toLowerCase().includes(query) ||
            g.full_name?.toLowerCase().includes(query) ||
            g.member_email.toLowerCase().includes(query) ||
            g.folder_name.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredGuests(guests);
    }
  }, [searchQuery, guests]);

  const handleBanGuest = async () => {
    if (!selectedGuest) return;

    try {
      const { error } = await supabase
        .from("guest_users")
        .update({
          is_banned: !selectedGuest.is_banned,
          ban_reason: selectedGuest.is_banned ? null : banReason,
          banned_at: selectedGuest.is_banned ? null : new Date().toISOString(),
        })
        .eq("id", selectedGuest.id);

      if (error) throw error;

      toast({
        title: selectedGuest.is_banned ? "Guest Unbanned" : "Guest Banned",
        description: `${selectedGuest.email} has been ${selectedGuest.is_banned ? "unbanned" : "banned"}.`,
      });

      setBanDialogOpen(false);
      setBanReason("");
      setSelectedGuest(null);
      fetchGuests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveAccess = async (guest: GuestWithAccess) => {
    try {
      const { error } = await supabase
        .from("guest_folder_access")
        .delete()
        .eq("guest_id", guest.id)
        .eq("member_id", guest.member_id);

      if (error) throw error;

      toast({
        title: "Access Removed",
        description: `Removed ${guest.email}'s access to ${guest.folder_name}.`,
      });

      fetchGuests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedGuest || !newPassword.trim()) return;

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-guest-password", {
        body: { guestId: selectedGuest.id, newPassword }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to reset password");

      toast({
        title: "Password Reset",
        description: `Password for ${selectedGuest.email} has been reset.`,
      });

      setResetPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedGuest(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const uniqueGuests = [...new Map(guests.map(g => [g.id, g])).values()];
  const bannedCount = uniqueGuests.filter(g => g.is_banned).length;
  const restrictedCount = guests.filter(g => g.is_restricted).length;

  return (
    <DashboardLayout>
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            Guest Controls
          </h1>
          <p className="text-white/50 mt-1">
            View and manage all guests across all members
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-4"
        >
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Total Guests</CardTitle>
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{uniqueGuests.length}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Total Accesses</CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <FolderKey className="h-4 w-4 text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{guests.length}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Banned</CardTitle>
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Ban className="h-4 w-4 text-red-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-400">{bannedCount}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Restricted</CardTitle>
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <UserX className="h-4 w-4 text-yellow-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-400">{restrictedCount}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Search and Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle className="text-white">All Guests</CardTitle>
              <CardDescription className="text-white/50">
                Manage guests from all members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search by guest, member, or folder..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchGuests}
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {loading ? (
                <SkeletonTable rows={5} />
              ) : filteredGuests.length === 0 ? (
                <div className="text-center py-8 text-white/50">No guests found</div>
              ) : (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Guest</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Folder</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-white/60">Joined</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGuests.map((guest, idx) => (
                        <TableRow key={`${guest.id}-${guest.member_id}-${idx}`} className="border-white/10 hover:bg-white/5">
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{guest.full_name || "No name"}</div>
                              <div className="text-sm text-white/50">{guest.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-white/80">{guest.member_name}</div>
                              <div className="text-sm text-white/50">{guest.member_email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-white/70">{guest.folder_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {guest.is_banned && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Banned</Badge>
                              )}
                              {guest.is_restricted && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Restricted</Badge>
                              )}
                              {!guest.is_banned && !guest.is_restricted && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-white/60">
                            {format(new Date(guest.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedGuest(guest);
                                  setBanDialogOpen(true);
                                }}
                                className={guest.is_banned 
                                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" 
                                  : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                }
                              >
                                {guest.is_banned ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedGuest(guest);
                                  setResetPasswordDialogOpen(true);
                                }}
                                className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAccess(guest)}
                                className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
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
        </motion.div>
      </PageTransition>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedGuest?.is_banned ? "Unban Guest" : "Ban Guest"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {selectedGuest?.is_banned
                ? `Are you sure you want to unban ${selectedGuest?.email}?`
                : `This will prevent ${selectedGuest?.email} from accessing any shared folders.`}
            </DialogDescription>
          </DialogHeader>
          {!selectedGuest?.is_banned && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Reason (optional)</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter ban reason..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBanDialogOpen(false)}
              className="border-white/10 text-white/70"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBanGuest}
              className={selectedGuest?.is_banned 
                ? "bg-emerald-500 hover:bg-emerald-400" 
                : "bg-red-500 hover:bg-red-400"
              }
            >
              {selectedGuest?.is_banned ? "Unban" : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Guest Password</DialogTitle>
            <DialogDescription className="text-white/50">
              Set a new password for {selectedGuest?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setResetPasswordDialogOpen(false)}
              className="border-white/10 text-white/70"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword} 
              disabled={resetting || newPassword.length < 6}
              className="bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OwnerGuestControls;

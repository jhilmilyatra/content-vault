import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Ban, UserX, Users, Shield, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guest Controls</h1>
          <p className="text-muted-foreground">
            View and manage all guests across all members
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueGuests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Accesses</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{guests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Banned</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{bannedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Restricted</CardTitle>
              <UserX className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{restrictedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Guests</CardTitle>
            <CardDescription>
              Manage guests from all members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest, member, or folder..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={fetchGuests}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading guests...</div>
            ) : filteredGuests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No guests found</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGuests.map((guest, idx) => (
                      <TableRow key={`${guest.id}-${guest.member_id}-${idx}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{guest.full_name || "No name"}</div>
                            <div className="text-sm text-muted-foreground">{guest.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{guest.member_name}</div>
                            <div className="text-sm text-muted-foreground">{guest.member_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{guest.folder_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {guest.is_banned && (
                              <Badge variant="destructive">Banned</Badge>
                            )}
                            {guest.is_restricted && (
                              <Badge variant="secondary">Restricted</Badge>
                            )}
                            {!guest.is_banned && !guest.is_restricted && (
                              <Badge variant="outline">Active</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(guest.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={guest.is_banned ? "outline" : "destructive"}
                              size="sm"
                              onClick={() => {
                                setSelectedGuest(guest);
                                setBanDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              {guest.is_banned ? "Unban" : "Ban"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedGuest(guest);
                                setResetPasswordDialogOpen(true);
                              }}
                            >
                              <KeyRound className="h-4 w-4 mr-1" />
                              Reset PW
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveAccess(guest)}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Remove
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
      </div>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGuest?.is_banned ? "Unban Guest" : "Ban Guest"}
            </DialogTitle>
            <DialogDescription>
              {selectedGuest?.is_banned
                ? `Are you sure you want to unban ${selectedGuest?.email}?`
                : `This will prevent ${selectedGuest?.email} from accessing any shared folders.`}
            </DialogDescription>
          </DialogHeader>
          {!selectedGuest?.is_banned && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter ban reason..."
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={selectedGuest?.is_banned ? "default" : "destructive"}
              onClick={handleBanGuest}
            >
              {selectedGuest?.is_banned ? "Unban" : "Ban"}
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
              Set a new password for {selectedGuest?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}>
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

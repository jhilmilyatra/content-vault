import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Search,
  MoreHorizontal,
  Shield,
  Crown,
  User,
  Ban,
  CheckCircle,
  Edit,
  Trash2,
  Plus,
  UserPlus,
  Calendar,
  HardDrive,
  Download,
  Link2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserWithDetails {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  role: string;
  plan: string;
  storage_limit_gb: number;
  bandwidth_limit_gb: number;
  max_active_links: number;
  valid_until: string | null;
  is_active: boolean;
}

const OwnerUserManagement = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [grantPremiumDialogOpen, setGrantPremiumDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  
  const [editForm, setEditForm] = useState({
    role: "",
    plan: "",
    storageLimit: "",
    bandwidthLimit: "",
    maxLinks: "",
    validUntil: "",
    reason: "",
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: subscriptions } = await supabase.from("subscriptions").select("*");

      const usersWithDetails = profiles?.map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        const subscription = subscriptions?.find((s) => s.user_id === profile.user_id);

        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: userRole?.role || "member",
          plan: subscription?.plan || "free",
          storage_limit_gb: subscription?.storage_limit_gb || 5,
          bandwidth_limit_gb: subscription?.bandwidth_limit_gb || 50,
          max_active_links: subscription?.max_active_links || 10,
          valid_until: subscription?.valid_until,
          is_active: subscription?.is_active ?? true,
        };
      }) || [];

      setUsers(usersWithDetails);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (userItem: UserWithDetails) => {
    setSelectedUser(userItem);
    setEditForm({
      role: userItem.role,
      plan: userItem.plan,
      storageLimit: userItem.storage_limit_gb.toString(),
      bandwidthLimit: userItem.bandwidth_limit_gb.toString(),
      maxLinks: userItem.max_active_links.toString(),
      validUntil: userItem.valid_until ? userItem.valid_until.split("T")[0] : "",
      reason: "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedUser || !editForm.reason.trim()) {
      toast({ title: "Error", description: "Please provide a reason", variant: "destructive" });
      return;
    }

    try {
      // Update role
      if (editForm.role !== selectedUser.role) {
        await supabase
          .from("user_roles")
          .update({ role: editForm.role as "owner" | "admin" | "member" })
          .eq("user_id", selectedUser.user_id);

        await supabase.from("audit_logs").insert({
          actor_id: user?.id,
          target_user_id: selectedUser.user_id,
          action: "role_change",
          entity_type: "user_roles",
          details: { previous: selectedUser.role, new: editForm.role, reason: editForm.reason },
        });
      }

      // Update subscription
      const updates: Record<string, unknown> = {
        plan: editForm.plan as "free" | "premium" | "lifetime",
        storage_limit_gb: parseInt(editForm.storageLimit),
        bandwidth_limit_gb: parseInt(editForm.bandwidthLimit),
        max_active_links: parseInt(editForm.maxLinks),
      };

      if (editForm.validUntil) {
        updates.valid_until = new Date(editForm.validUntil).toISOString();
      } else {
        updates.valid_until = null;
      }

      await supabase.from("subscriptions").update(updates).eq("user_id", selectedUser.user_id);

      // Log manual override
      await supabase.from("manual_overrides").insert({
        user_id: selectedUser.user_id,
        granted_by: user?.id,
        override_type: "full_update",
        previous_value: JSON.stringify({
          plan: selectedUser.plan,
          storage: selectedUser.storage_limit_gb,
          bandwidth: selectedUser.bandwidth_limit_gb,
          links: selectedUser.max_active_links,
        }),
        new_value: JSON.stringify(updates),
        reason: editForm.reason,
        expires_at: editForm.validUntil ? new Date(editForm.validUntil).toISOString() : null,
      });

      await supabase.from("audit_logs").insert([{
        actor_id: user?.id,
        target_user_id: selectedUser.user_id,
        action: "subscription_update",
        entity_type: "subscriptions",
        details: JSON.parse(JSON.stringify({ updates, reason: editForm.reason })),
      }]);

      toast({ title: "Success", description: "User updated successfully" });
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    }
  };

  const handleQuickRoleChange = async (userItem: UserWithDetails, newRole: string) => {
    try {
      await supabase
        .from("user_roles")
        .update({ role: newRole as "owner" | "admin" | "member" })
        .eq("user_id", userItem.user_id);

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: userItem.user_id,
        action: newRole === "admin" ? "admin_added" : newRole === "member" ? "admin_removed" : "role_change",
        entity_type: "user_roles",
        details: { previous: userItem.role, new: newRole },
      });

      toast({ title: "Success", description: `User role changed to ${newRole}` });
      fetchUsers();
    } catch (error) {
      console.error("Error changing role:", error);
      toast({ title: "Error", description: "Failed to change role", variant: "destructive" });
    }
  };

  const handleQuickPlanChange = async (userItem: UserWithDetails, newPlan: string, validDays?: number) => {
    try {
      const updates: Record<string, unknown> = {
        plan: newPlan as "free" | "premium" | "lifetime",
      };

      if (newPlan === "premium" && validDays) {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validDays);
        updates.valid_until = validUntil.toISOString();
        updates.storage_limit_gb = 100;
        updates.bandwidth_limit_gb = 500;
        updates.max_active_links = 100;
      } else if (newPlan === "lifetime") {
        updates.valid_until = null;
        updates.storage_limit_gb = 1000;
        updates.bandwidth_limit_gb = 5000;
        updates.max_active_links = 1000;
      } else if (newPlan === "free") {
        updates.valid_until = null;
        updates.storage_limit_gb = 5;
        updates.bandwidth_limit_gb = 50;
        updates.max_active_links = 10;
      }

      await supabase.from("subscriptions").update(updates).eq("user_id", userItem.user_id);

      await supabase.from("manual_overrides").insert({
        user_id: userItem.user_id,
        granted_by: user?.id,
        override_type: "plan_change",
        previous_value: userItem.plan,
        new_value: newPlan,
        reason: `Quick plan change to ${newPlan}`,
        expires_at: updates.valid_until as string | null,
      });

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: userItem.user_id,
        action: "plan_change",
        entity_type: "subscriptions",
        details: { previous: userItem.plan, new: newPlan, validity: validDays ? `${validDays} days` : "unlimited" },
      });

      toast({ title: "Success", description: `User plan changed to ${newPlan}` });
      fetchUsers();
    } catch (error) {
      console.error("Error changing plan:", error);
      toast({ title: "Error", description: "Failed to change plan", variant: "destructive" });
    }
  };

  const toggleUserStatus = async (userItem: UserWithDetails) => {
    try {
      await supabase.from("subscriptions").update({ is_active: !userItem.is_active }).eq("user_id", userItem.user_id);

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: userItem.user_id,
        action: userItem.is_active ? "user_suspended" : "user_activated",
        entity_type: "subscriptions",
        details: {},
      });

      toast({ title: "Success", description: `User ${userItem.is_active ? "suspended" : "activated"}` });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="w-4 h-4 text-amber-500" />;
      case "admin": return <Shield className="w-4 h-4 text-violet-500" />;
      default: return <User className="w-4 h-4 text-primary" />;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "lifetime": return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Lifetime</Badge>;
      case "premium": return <Badge className="bg-violet-500/20 text-violet-500 border-violet-500/30">Premium</Badge>;
      default: return <Badge variant="outline">Free</Badge>;
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const admins = filteredUsers.filter((u) => u.role === "admin");
  const premiumUsers = filteredUsers.filter((u) => u.plan === "premium" || u.plan === "lifetime");
  const freeUsers = filteredUsers.filter((u) => u.plan === "free" && u.role === "member");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground">Full control over users, roles, and subscriptions</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Users ({filteredUsers.length})</TabsTrigger>
            <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
            <TabsTrigger value="premium">Premium ({premiumUsers.length})</TabsTrigger>
            <TabsTrigger value="free">Free ({freeUsers.length})</TabsTrigger>
          </TabsList>

          {["all", "admins", "premium", "free"].map((tab) => {
            const tabUsers =
              tab === "admins" ? admins : tab === "premium" ? premiumUsers : tab === "free" ? freeUsers : filteredUsers;

            return (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : tabUsers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No users found</div>
                    ) : (
                      <div className="space-y-2">
                        {tabUsers.map((userItem, index) => (
                          <motion.div
                            key={userItem.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                              userItem.is_active ? "bg-card hover:bg-muted/50" : "bg-destructive/5 border-destructive/20"
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                              {userItem.full_name?.[0]?.toUpperCase() || userItem.email?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground truncate">{userItem.full_name || "No name"}</p>
                                {getRoleIcon(userItem.role)}
                                {!userItem.is_active && <Badge variant="destructive">Suspended</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{userItem.email}</p>
                            </div>
                            <div className="hidden md:flex items-center gap-3">
                              {getPlanBadge(userItem.plan)}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <HardDrive className="w-3 h-3" />
                                {userItem.storage_limit_gb}GB
                              </div>
                              {userItem.valid_until && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {new Date(userItem.valid_until).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => openEditDialog(userItem)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Full Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleQuickRoleChange(userItem, userItem.role === "admin" ? "member" : "admin")}
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  {userItem.role === "admin" ? "Remove Admin" : "Make Admin"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "premium", 30)}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Grant Premium (30 days)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "premium", 90)}>
                                  <Calendar className="w-4 h-4 mr-2" />
                                  Grant Premium (90 days)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "lifetime")}>
                                  <Crown className="w-4 h-4 mr-2" />
                                  Grant Lifetime
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "free")}>
                                  <User className="w-4 h-4 mr-2" />
                                  Revoke to Free
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleUserStatus(userItem)}>
                                  {userItem.is_active ? (
                                    <>
                                      <Ban className="w-4 h-4 mr-2" />
                                      Suspend User
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Activate User
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Full Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit User - {selectedUser?.email}</DialogTitle>
              <DialogDescription>Full control over user settings</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Storage (GB)</Label>
                  <Input
                    type="number"
                    value={editForm.storageLimit}
                    onChange={(e) => setEditForm({ ...editForm, storageLimit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bandwidth (GB)</Label>
                  <Input
                    type="number"
                    value={editForm.bandwidthLimit}
                    onChange={(e) => setEditForm({ ...editForm, bandwidthLimit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Links</Label>
                  <Input
                    type="number"
                    value={editForm.maxLinks}
                    onChange={(e) => setEditForm({ ...editForm, maxLinks: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valid Until (optional)</Label>
                <Input
                  type="date"
                  value={editForm.validUntil}
                  onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for Changes *</Label>
                <Textarea
                  placeholder="Enter reason for this modification..."
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveChanges}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default OwnerUserManagement;

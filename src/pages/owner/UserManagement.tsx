import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition, staggerContainer, staggerItem } from "@/components/ui/PageTransition";
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
  Key,
  Loader2,
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
  is_suspended: boolean;
  suspension_reason: string | null;
}

const OwnerUserManagement = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [grantPremiumDialogOpen, setGrantPremiumDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  
  const [editForm, setEditForm] = useState({
    role: "",
    plan: "",
    storageLimit: "",
    bandwidthLimit: "",
    maxLinks: "",
    validUntil: "",
    reason: "",
  });

  const [addMemberForm, setAddMemberForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "member",
    plan: "free",
    storageLimit: "5",
    bandwidthLimit: "50",
    maxLinks: "10",
    validUntil: "",
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
          is_suspended: profile.is_suspended ?? false,
          suspension_reason: profile.suspension_reason,
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
      const response = await supabase.functions.invoke('owner-update-user', {
        body: {
          targetUserId: selectedUser.user_id,
          updates: {
            role: editForm.role !== selectedUser.role ? editForm.role : undefined,
            plan: editForm.plan,
            storageLimit: parseInt(editForm.storageLimit),
            bandwidthLimit: parseInt(editForm.bandwidthLimit),
            maxLinks: parseInt(editForm.maxLinks),
            validUntil: editForm.validUntil ? new Date(editForm.validUntil).toISOString() : null,
          },
          reason: editForm.reason,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "User updated successfully" });
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update user";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleQuickRoleChange = async (userItem: UserWithDetails, newRole: string) => {
    try {
      const response = await supabase.functions.invoke('owner-update-user', {
        body: {
          targetUserId: userItem.user_id,
          updates: { role: newRole },
          reason: `Quick role change to ${newRole}`,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: `User role changed to ${newRole}` });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error changing role:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to change role";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleQuickPlanChange = async (userItem: UserWithDetails, newPlan: string, validDays?: number) => {
    try {
      let validUntil: string | null = null;
      let storageLimit = 5;
      let bandwidthLimit = 50;
      let maxLinks = 10;

      if (newPlan === "premium" && validDays) {
        const validDate = new Date();
        validDate.setDate(validDate.getDate() + validDays);
        validUntil = validDate.toISOString();
        storageLimit = 100;
        bandwidthLimit = 500;
        maxLinks = 100;
      } else if (newPlan === "lifetime") {
        validUntil = null;
        storageLimit = 1000;
        bandwidthLimit = 5000;
        maxLinks = 1000;
      }

      const response = await supabase.functions.invoke('owner-update-user', {
        body: {
          targetUserId: userItem.user_id,
          updates: {
            plan: newPlan,
            storageLimit,
            bandwidthLimit,
            maxLinks,
            validUntil,
          },
          reason: `Quick plan change to ${newPlan}${validDays ? ` (${validDays} days)` : ''}`,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: `User plan changed to ${newPlan}` });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error changing plan:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to change plan";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const toggleUserStatus = async (userItem: UserWithDetails) => {
    try {
      const response = await supabase.functions.invoke('owner-update-user', {
        body: {
          targetUserId: userItem.user_id,
          updates: { isActive: !userItem.is_active },
          reason: userItem.is_active ? "User deactivated" : "User activated",
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: `User ${userItem.is_active ? "deactivated" : "activated"}` });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error toggling status:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update status";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const liftRestriction = async (userItem: UserWithDetails) => {
    try {
      const response = await supabase.functions.invoke('owner-update-user', {
        body: {
          targetUserId: userItem.user_id,
          updates: { liftRestriction: true },
          reason: "Restriction lifted by owner",
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "Restriction lifted. User has 7 more days." });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error lifting restriction:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to lift restriction";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast({ title: "Error", description: "Please enter a new password", variant: "destructive" });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setResetPasswordLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('reset-user-password', {
        body: {
          targetUserId: selectedUser.user_id,
          newPassword: newPassword,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "Password reset successfully" });
      setResetPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberForm.email || !addMemberForm.password) {
      toast({ title: "Error", description: "Email and password are required", variant: "destructive" });
      return;
    }

    if (addMemberForm.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setAddMemberLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call edge function to create user
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: addMemberForm.email,
          password: addMemberForm.password,
          fullName: addMemberForm.fullName,
          role: addMemberForm.role,
          plan: addMemberForm.plan,
          storageLimit: parseInt(addMemberForm.storageLimit),
          bandwidthLimit: parseInt(addMemberForm.bandwidthLimit),
          maxLinks: parseInt(addMemberForm.maxLinks),
          validUntil: addMemberForm.validUntil || null,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "Success", description: "User created successfully" });
      setAddMemberDialogOpen(false);
      setAddMemberForm({
        email: "",
        password: "",
        fullName: "",
        role: "member",
        plan: "free",
        storageLimit: "5",
        bandwidthLimit: "50",
        maxLinks: "10",
        validUntil: "",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    } finally {
      setAddMemberLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="w-4 h-4 text-amber-400" />;
      case "admin": return <Shield className="w-4 h-4 text-violet-400" />;
      default: return <User className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "lifetime": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Lifetime</Badge>;
      case "premium": return <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">Premium</Badge>;
      default: return <Badge className="bg-white/10 text-white/60 border-white/20">Free</Badge>;
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
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              User Management
            </h1>
            <p className="text-white/50 mt-1">Full control over users, roles, and subscriptions</p>
          </div>
          <Button 
            onClick={() => setAddMemberDialogOpen(true)} 
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </Button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative max-w-md"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              All Users ({filteredUsers.length})
            </TabsTrigger>
            <TabsTrigger value="admins" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              Admins ({admins.length})
            </TabsTrigger>
            <TabsTrigger value="premium" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              Premium ({premiumUsers.length})
            </TabsTrigger>
            <TabsTrigger value="free" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              Free ({freeUsers.length})
            </TabsTrigger>
          </TabsList>

          {["all", "admins", "premium", "free"].map((tab) => {
            const tabUsers =
              tab === "admins" ? admins : tab === "premium" ? premiumUsers : tab === "free" ? freeUsers : filteredUsers;

            return (
              <TabsContent key={tab} value={tab}>
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="text-center py-8 text-white/50">Loading...</div>
                    ) : tabUsers.length === 0 ? (
                      <div className="text-center py-8 text-white/50">No users found</div>
                    ) : (
                      <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="space-y-2"
                      >
                        {tabUsers.map((userItem, index) => (
                          <motion.div
                            key={userItem.id}
                            variants={staggerItem}
                            className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                                {getRoleIcon(userItem.role)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{userItem.full_name || userItem.email}</span>
                                  {getPlanBadge(userItem.plan)}
                                  {!userItem.is_active && (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>
                                  )}
                                  {userItem.is_suspended && (
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Suspended</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-white/50">{userItem.email}</div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-white/40">
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" />
                                    {userItem.storage_limit_gb} GB
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Link2 className="w-3 h-3" />
                                    {userItem.max_active_links} links
                                  </span>
                                  {userItem.valid_until && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Until {new Date(userItem.valid_until).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/10">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-black/90 backdrop-blur-xl border-white/10">
                                <DropdownMenuItem onClick={() => openEditDialog(userItem)} className="text-white/80 focus:text-white focus:bg-white/10">
                                  <Edit className="w-4 h-4 mr-2" />
                                  Full Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedUser(userItem);
                                  setResetPasswordDialogOpen(true);
                                }} className="text-white/80 focus:text-white focus:bg-white/10">
                                  <Key className="w-4 h-4 mr-2" />
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                {userItem.role !== "owner" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleQuickRoleChange(userItem, userItem.role === "admin" ? "member" : "admin")} className="text-white/80 focus:text-white focus:bg-white/10">
                                      <Shield className="w-4 h-4 mr-2" />
                                      {userItem.role === "admin" ? "Remove Admin" : "Make Admin"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "premium", 30)} className="text-violet-400 focus:text-violet-300 focus:bg-violet-500/10">
                                  <Crown className="w-4 h-4 mr-2" />
                                  Grant 30 Days Premium
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "lifetime")} className="text-amber-400 focus:text-amber-300 focus:bg-amber-500/10">
                                  <Crown className="w-4 h-4 mr-2" />
                                  Grant Lifetime
                                </DropdownMenuItem>
                                {userItem.plan !== "free" && (
                                  <DropdownMenuItem onClick={() => handleQuickPlanChange(userItem, "free")} className="text-white/60 focus:text-white focus:bg-white/10">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Revoke Premium
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem onClick={() => toggleUserStatus(userItem)} className={userItem.is_active ? "text-red-400 focus:text-red-300 focus:bg-red-500/10" : "text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10"}>
                                  {userItem.is_active ? (
                                    <>
                                      <Ban className="w-4 h-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </PageTransition>

      {/* Full Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
            <DialogDescription className="text-white/50">
              Modify {selectedUser?.full_name || selectedUser?.email}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10">
                    <SelectItem value="member" className="text-white focus:bg-white/10">Member</SelectItem>
                    <SelectItem value="admin" className="text-white focus:bg-white/10">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Plan</Label>
                <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10">
                    <SelectItem value="free" className="text-white focus:bg-white/10">Free</SelectItem>
                    <SelectItem value="premium" className="text-white focus:bg-white/10">Premium</SelectItem>
                    <SelectItem value="lifetime" className="text-white focus:bg-white/10">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Storage (GB)</Label>
                <Input
                  type="number"
                  value={editForm.storageLimit}
                  onChange={(e) => setEditForm(f => ({ ...f, storageLimit: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Bandwidth (GB)</Label>
                <Input
                  type="number"
                  value={editForm.bandwidthLimit}
                  onChange={(e) => setEditForm(f => ({ ...f, bandwidthLimit: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Max Links</Label>
                <Input
                  type="number"
                  value={editForm.maxLinks}
                  onChange={(e) => setEditForm(f => ({ ...f, maxLinks: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Valid Until</Label>
              <Input
                type="date"
                value={editForm.validUntil}
                onChange={(e) => setEditForm(f => ({ ...f, validUntil: e.target.value }))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Reason for change *</Label>
              <Textarea
                value={editForm.reason}
                onChange={(e) => setEditForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Why are you making these changes?"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-white/10 text-white/70">
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} className="bg-gradient-to-r from-cyan-500 to-blue-500">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-white/50">
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label className="text-white/70">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)} className="border-white/10 text-white/70">
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordLoading || newPassword.length < 6} className="bg-gradient-to-r from-cyan-500 to-blue-500">
              {resetPasswordLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Member</DialogTitle>
            <DialogDescription className="text-white/50">
              Create a new user account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Email *</Label>
                <Input
                  type="email"
                  value={addMemberForm.email}
                  onChange={(e) => setAddMemberForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Password *</Label>
                <Input
                  type="password"
                  value={addMemberForm.password}
                  onChange={(e) => setAddMemberForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/70">Full Name</Label>
              <Input
                value={addMemberForm.fullName}
                onChange={(e) => setAddMemberForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="John Doe"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Role</Label>
                <Select value={addMemberForm.role} onValueChange={(v) => setAddMemberForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10">
                    <SelectItem value="member" className="text-white focus:bg-white/10">Member</SelectItem>
                    <SelectItem value="admin" className="text-white focus:bg-white/10">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Plan</Label>
                <Select value={addMemberForm.plan} onValueChange={(v) => setAddMemberForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/10">
                    <SelectItem value="free" className="text-white focus:bg-white/10">Free</SelectItem>
                    <SelectItem value="premium" className="text-white focus:bg-white/10">Premium</SelectItem>
                    <SelectItem value="lifetime" className="text-white focus:bg-white/10">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70">Storage (GB)</Label>
                <Input
                  type="number"
                  value={addMemberForm.storageLimit}
                  onChange={(e) => setAddMemberForm(f => ({ ...f, storageLimit: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Bandwidth (GB)</Label>
                <Input
                  type="number"
                  value={addMemberForm.bandwidthLimit}
                  onChange={(e) => setAddMemberForm(f => ({ ...f, bandwidthLimit: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Max Links</Label>
                <Input
                  type="number"
                  value={addMemberForm.maxLinks}
                  onChange={(e) => setAddMemberForm(f => ({ ...f, maxLinks: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)} className="border-white/10 text-white/70">
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={addMemberLoading} className="bg-gradient-to-r from-cyan-500 to-blue-500">
              {addMemberLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OwnerUserManagement;

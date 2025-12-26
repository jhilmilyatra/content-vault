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

interface UserWithDetails {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  role: string;
  plan: string;
  storage_limit_gb: number;
  is_active: boolean;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "",
    plan: "",
    storageLimit: "",
    reason: "",
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Fetch subscriptions
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, plan, storage_limit_gb, is_active");

      // Combine data
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
          is_active: subscription?.is_active ?? true,
        };
      }) || [];

      setUsers(usersWithDetails);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userItem: UserWithDetails) => {
    setSelectedUser(userItem);
    setEditForm({
      role: userItem.role,
      plan: userItem.plan,
      storageLimit: userItem.storage_limit_gb.toString(),
      reason: "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedUser || !editForm.reason) {
      toast({
        title: "Error",
        description: "Please provide a reason for the changes",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update role if changed
      if (editForm.role !== selectedUser.role) {
        await supabase
          .from("user_roles")
          .update({ role: editForm.role as "owner" | "admin" | "member" })
          .eq("user_id", selectedUser.user_id);

        // Log the action
        await supabase.from("audit_logs").insert({
          actor_id: user?.id,
          target_user_id: selectedUser.user_id,
          action: "role_change",
          entity_type: "user_roles",
          details: {
            previous_role: selectedUser.role,
            new_role: editForm.role,
            reason: editForm.reason,
          },
        });
      }

      // Update subscription if changed
      if (
        editForm.plan !== selectedUser.plan ||
        parseInt(editForm.storageLimit) !== selectedUser.storage_limit_gb
      ) {
        await supabase
          .from("subscriptions")
          .update({
            plan: editForm.plan as "free" | "premium" | "lifetime",
            storage_limit_gb: parseInt(editForm.storageLimit),
          })
          .eq("user_id", selectedUser.user_id);

        // Log manual override
        await supabase.from("manual_overrides").insert({
          user_id: selectedUser.user_id,
          granted_by: user?.id,
          override_type: "subscription_change",
          previous_value: JSON.stringify({
            plan: selectedUser.plan,
            storage_limit_gb: selectedUser.storage_limit_gb,
          }),
          new_value: JSON.stringify({
            plan: editForm.plan,
            storage_limit_gb: parseInt(editForm.storageLimit),
          }),
          reason: editForm.reason,
        });

        // Log audit
        await supabase.from("audit_logs").insert({
          actor_id: user?.id,
          target_user_id: selectedUser.user_id,
          action: "subscription_change",
          entity_type: "subscriptions",
          details: {
            previous_plan: selectedUser.plan,
            new_plan: editForm.plan,
            previous_storage: selectedUser.storage_limit_gb,
            new_storage: parseInt(editForm.storageLimit),
            reason: editForm.reason,
          },
        });
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userItem: UserWithDetails) => {
    try {
      await supabase
        .from("subscriptions")
        .update({ is_active: !userItem.is_active })
        .eq("user_id", userItem.user_id);

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        target_user_id: userItem.user_id,
        action: userItem.is_active ? "user_suspended" : "user_activated",
        entity_type: "subscriptions",
        details: { reason: "Manual toggle by owner" },
      });

      toast({
        title: "Success",
        description: `User ${userItem.is_active ? "suspended" : "activated"} successfully`,
      });

      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-amber-500" />;
      case "admin":
        return <Shield className="w-4 h-4 text-violet-500" />;
      default:
        return <User className="w-4 h-4 text-primary" />;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "lifetime":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Lifetime</Badge>;
      case "premium":
        return <Badge className="bg-violet-500/20 text-violet-500 border-violet-500/30">Premium</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage users, roles, and subscriptions
            </p>
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

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((userItem, index) => (
                  <motion.div
                    key={userItem.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      userItem.is_active
                        ? "bg-card hover:bg-muted/50"
                        : "bg-destructive/5 border-destructive/20"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                      {userItem.full_name?.[0]?.toUpperCase() ||
                        userItem.email?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {userItem.full_name || "No name"}
                        </p>
                        {getRoleIcon(userItem.role)}
                        {!userItem.is_active && (
                          <Badge variant="destructive" className="text-xs">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {userItem.email}
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-4">
                      {getPlanBadge(userItem.plan)}
                      <span className="text-sm text-muted-foreground">
                        {userItem.storage_limit_gb} GB
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(userItem)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user role, plan, and storage allocation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, role: value })
                  }
                >
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
                <Select
                  value={editForm.plan}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, plan: value })
                  }
                >
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
              <div className="space-y-2">
                <Label>Storage Limit (GB)</Label>
                <Input
                  type="number"
                  value={editForm.storageLimit}
                  onChange={(e) =>
                    setEditForm({ ...editForm, storageLimit: e.target.value })
                  }
                  min={1}
                  max={10000}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for Changes *</Label>
                <Textarea
                  placeholder="Enter reason for this modification..."
                  value={editForm.reason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, reason: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;

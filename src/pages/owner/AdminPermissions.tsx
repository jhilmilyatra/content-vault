import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Search,
  Mail,
  UserX,
  FileText,
  Trash2,
  Eye,
  CheckSquare,
  Loader2,
  Save,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface AdminWithPermissions {
  user_id: string;
  email: string | null;
  full_name: string | null;
  permissions: {
    can_view_emails: boolean;
    can_suspend_users: boolean;
    can_view_reports: boolean;
    can_resolve_reports: boolean;
    can_view_files: boolean;
    can_delete_files: boolean;
  } | null;
}

const defaultPermissions = {
  can_view_emails: false,
  can_suspend_users: true,
  can_view_reports: true,
  can_resolve_reports: true,
  can_view_files: false,
  can_delete_files: false,
};

const AdminPermissions = () => {
  const [admins, setAdmins] = useState<AdminWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      // Get all admin users
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      if (!adminRoles || adminRoles.length === 0) {
        setAdmins([]);
        setLoading(false);
        return;
      }

      const adminUserIds = adminRoles.map((r) => r.user_id);

      // Get profiles for these admins
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", adminUserIds);

      if (profilesError) throw profilesError;

      // Get permissions for these admins
      const { data: permissions, error: permError } = await supabase
        .from("admin_permissions")
        .select("*")
        .in("user_id", adminUserIds);

      if (permError) throw permError;

      const adminsWithPerms = profiles?.map((profile) => {
        const perm = permissions?.find((p) => p.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          permissions: perm
            ? {
                can_view_emails: perm.can_view_emails,
                can_suspend_users: perm.can_suspend_users,
                can_view_reports: perm.can_view_reports,
                can_resolve_reports: perm.can_resolve_reports,
                can_view_files: perm.can_view_files,
                can_delete_files: perm.can_delete_files,
              }
            : null,
        };
      }) || [];

      setAdmins(adminsWithPerms);
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast({ title: "Error", description: "Failed to fetch admins", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (
    adminUserId: string,
    permissionKey: keyof typeof defaultPermissions,
    value: boolean
  ) => {
    setSaving(adminUserId);
    try {
      const admin = admins.find((a) => a.user_id === adminUserId);
      const currentPerms = admin?.permissions || defaultPermissions;
      const newPerms = { ...currentPerms, [permissionKey]: value };

      // Check if permissions record exists
      const { data: existing } = await supabase
        .from("admin_permissions")
        .select("id")
        .eq("user_id", adminUserId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("admin_permissions")
          .update({
            [permissionKey]: value,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", adminUserId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from("admin_permissions").insert({
          user_id: adminUserId,
          ...newPerms,
          granted_by: user?.id,
        });

        if (error) throw error;
      }

      // Update local state
      setAdmins((prev) =>
        prev.map((a) =>
          a.user_id === adminUserId ? { ...a, permissions: newPerms } : a
        )
      );

      toast({ title: "Success", description: "Permission updated" });
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({ title: "Error", description: "Failed to update permission", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const initializePermissions = async (adminUserId: string) => {
    setSaving(adminUserId);
    try {
      const { error } = await supabase.from("admin_permissions").insert({
        user_id: adminUserId,
        ...defaultPermissions,
        granted_by: user?.id,
      });

      if (error) throw error;

      setAdmins((prev) =>
        prev.map((a) =>
          a.user_id === adminUserId ? { ...a, permissions: defaultPermissions } : a
        )
      );

      toast({ title: "Success", description: "Permissions initialized" });
    } catch (error) {
      console.error("Error initializing permissions:", error);
      toast({ title: "Error", description: "Failed to initialize permissions", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const filteredAdmins = admins.filter(
    (a) =>
      a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const permissionsList = [
    { key: "can_view_emails" as const, label: "View User Emails", icon: Mail, description: "Can see email addresses of all users" },
    { key: "can_suspend_users" as const, label: "Suspend Users", icon: UserX, description: "Can suspend/unsuspend member accounts" },
    { key: "can_view_reports" as const, label: "View Reports", icon: Eye, description: "Can view submitted reports" },
    { key: "can_resolve_reports" as const, label: "Resolve Reports", icon: CheckSquare, description: "Can resolve and manage reports" },
    { key: "can_view_files" as const, label: "View All Files", icon: FileText, description: "Can view files from all users" },
    { key: "can_delete_files" as const, label: "Delete Files", icon: Trash2, description: "Can delete files from any user" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Permissions
          </h1>
          <p className="text-muted-foreground">Control what actions admins can perform</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search admins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Admins List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAdmins.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No admins found</p>
              <p className="text-sm">Promote users to admin role to manage their permissions here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredAdmins.map((admin, index) => (
              <motion.div
                key={admin.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-violet-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {admin.full_name || "Unnamed Admin"}
                            <Badge variant="outline" className="text-xs">Admin</Badge>
                          </CardTitle>
                          <CardDescription>{admin.email}</CardDescription>
                        </div>
                      </div>
                      {saving === admin.user_id && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {admin.permissions === null ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground mb-4">
                          This admin has no permissions configured yet.
                        </p>
                        <Button
                          onClick={() => initializePermissions(admin.user_id)}
                          disabled={saving === admin.user_id}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Initialize Default Permissions
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {permissionsList.map(({ key, label, icon: Icon, description }) => (
                          <div
                            key={key}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="mt-0.5">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`${admin.user_id}-${key}`} className="text-sm font-medium cursor-pointer">
                                  {label}
                                </Label>
                                <Switch
                                  id={`${admin.user_id}-${key}`}
                                  checked={admin.permissions?.[key] ?? false}
                                  onCheckedChange={(checked) => updatePermission(admin.user_id, key, checked)}
                                  disabled={saving === admin.user_id}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Owner Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              As the owner, you have full access to all features regardless of permission settings.
              These settings only apply to admin-level users.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPermissions;

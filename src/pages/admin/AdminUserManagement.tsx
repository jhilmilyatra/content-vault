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
  Ban,
  CheckCircle,
  Eye,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { SkeletonList } from "@/components/ios/SkeletonLoader";
import { IosModal } from "@/components/ios/IosModal";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { lightHaptic } from "@/lib/haptics";

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, is_suspended, suspension_reason, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers((data as UserProfile[]) || []);
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

  const handleSuspendUser = async () => {
    if (!selectedUser || !suspensionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a suspension reason",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await supabase.functions.invoke('admin-suspend-user', {
        body: {
          targetUserId: selectedUser.user_id,
          suspend: true,
          reason: suspensionReason,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "User suspended successfully" });
      setSuspendDialogOpen(false);
      setSelectedUser(null);
      setSuspensionReason("");
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error suspending user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to suspend user";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUnsuspendUser = async (userProfile: UserProfile) => {
    try {
      const response = await supabase.functions.invoke('admin-suspend-user', {
        body: {
          targetUserId: userProfile.user_id,
          suspend: false,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast({ title: "User unsuspended successfully" });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error unsuspending user:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to unsuspend user";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6 px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl ios-glass flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            User Moderation
          </h1>
          <p className="text-muted-foreground mt-1 ml-13">
            View and moderate user accounts
          </p>
        </div>

        {/* Search */}
        <div className="relative animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-2xl ios-glass border-0 text-base"
          />
        </div>

        {/* Users List */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <GlassCardHeader
            title={`All Users (${filteredUsers.length})`}
            icon={<Users className="w-5 h-5" />}
          />
          
          <div className="p-4">
            {loading ? (
              <SkeletonList />
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No users found</p>
              </div>
            ) : (
              <motion.div 
                className="space-y-2"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {filteredUsers.map((userProfile) => (
                  <motion.div
                    key={userProfile.id}
                    variants={staggerItem}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                      userProfile.is_suspended
                        ? "bg-destructive/10 border border-destructive/20"
                        : "ios-glass-subtle hover:bg-muted/30"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {userProfile.full_name?.[0]?.toUpperCase() ||
                        userProfile.email?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">
                          {userProfile.full_name || "No name"}
                        </p>
                        {userProfile.is_suspended && (
                          <Badge variant="destructive" className="text-xs rounded-full px-2">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {userProfile.email}
                      </p>
                      {userProfile.is_suspended && userProfile.suspension_reason && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {userProfile.suspension_reason}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="rounded-full h-9 w-9"
                          onClick={() => lightHaptic()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="ios-glass-elevated rounded-2xl min-w-[180px]">
                        <DropdownMenuItem className="rounded-xl py-3">
                          <Eye className="w-4 h-4 mr-3" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl py-3">
                          <Mail className="w-4 h-4 mr-3" />
                          Send Message
                        </DropdownMenuItem>
                        {userProfile.is_suspended ? (
                          <DropdownMenuItem
                            onClick={() => handleUnsuspendUser(userProfile)}
                            className="rounded-xl py-3 text-emerald-500"
                          >
                            <CheckCircle className="w-4 h-4 mr-3" />
                            Unsuspend User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="rounded-xl py-3 text-destructive"
                            onClick={() => {
                              setSelectedUser(userProfile);
                              setSuspendDialogOpen(true);
                            }}
                          >
                            <Ban className="w-4 h-4 mr-3" />
                            Suspend User
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

        {/* Suspend Modal */}
        <IosModal
          open={suspendDialogOpen}
          onClose={() => setSuspendDialogOpen(false)}
          title="Suspend User"
          description="This will prevent the user from accessing their account."
          footer={
            <>
              <Button 
                variant="outline" 
                onClick={() => setSuspendDialogOpen(false)}
                className="flex-1 rounded-xl h-12"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSuspendUser}
                className="flex-1 rounded-xl h-12"
              >
                Suspend
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/30">
              <Label className="text-xs text-muted-foreground">User</Label>
              <p className="text-sm font-medium text-foreground">
                {selectedUser?.email}
              </p>
            </div>
            <div>
              <Label htmlFor="reason" className="text-sm font-medium">
                Suspension Reason *
              </Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for suspension..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="mt-2 rounded-xl ios-glass border-0 min-h-[100px]"
              />
            </div>
          </div>
        </IosModal>
      </motion.div>
    </DashboardLayout>
  );
};

export default AdminUserManagement;

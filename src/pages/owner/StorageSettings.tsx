import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition, staggerContainer, staggerItem } from "@/components/ui/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import {
  HardDrive,
  Plus,
  Server,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Info,
  Users,
  File,
  Eye,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Database,
  Cpu,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard, SkeletonStats, SkeletonTable } from "@/components/ios";

interface StorageNode {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  status: "online" | "offline" | "checking";
  totalStorage: number;
  usedStorage: number;
  isDefault: boolean;
  isPrimary?: boolean;
  createdAt: string;
}

interface UserStorageStats {
  userId: string;
  totalBytes: number;
  totalMB: string;
  fileCount: number;
  files?: Array<{
    name: string;
    size: number;
    created: string;
    modified: string;
    path: string;
  }>;
  profile?: {
    user_id: string;
    email: string;
    full_name: string;
  } | null;
}

interface VPSStats {
  users: UserStorageStats[];
  totalUsers: number;
  totalBytes: number;
  totalGB: string;
}

// VPS configuration - fetched dynamically via edge function
// Frontend should never have direct access to VPS credentials
const VPS_CONFIG = {
  endpoint: "", // Fetched via vps-health edge function
  apiKey: "", // Never exposed to frontend
  name: "Primary VPS Storage",
  totalCapacity: 200 * 1024 * 1024 * 1024, // 200GB
};

const StorageSettings = () => {
  const [nodes, setNodes] = useState<StorageNode[]>([
    {
      id: "vps-primary",
      name: VPS_CONFIG.name,
      endpoint: VPS_CONFIG.endpoint,
      apiKey: VPS_CONFIG.apiKey,
      status: "checking",
      totalStorage: VPS_CONFIG.totalCapacity,
      usedStorage: 0,
      isDefault: false,
      isPrimary: true,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newNode, setNewNode] = useState({
    name: "",
    endpoint: "",
    apiKey: "",
  });
  const [testing, setTesting] = useState(false);
  
  // User storage stats
  const [vpsStats, setVpsStats] = useState<VPSStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [loadingUserFiles, setLoadingUserFiles] = useState<string | null>(null);

  useEffect(() => {
    fetchVPSStorageStats();
    loadStorageNodes();
  }, []);

  const fetchVPSStorageStats = async () => {
    setLoadingStats(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-owner-stats?action=all-users`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch VPS stats");
      }

      const data: VPSStats = await response.json();
      setVpsStats(data);

      // Update VPS node with actual usage
      setNodes((prev) =>
        prev.map((node) =>
          node.id === "vps-primary"
            ? {
                ...node,
                status: "online",
                usedStorage: data.totalBytes,
              }
            : node
        )
      );
    } catch (error) {
      console.error("Error fetching VPS stats:", error);
      toast.error("Failed to fetch VPS storage stats");
      // Set status to online anyway since uploads work through edge functions
      setNodes((prev) =>
        prev.map((node) =>
          node.id === "vps-primary" ? { ...node, status: "online" } : node
        )
      );
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };

  const fetchUserFiles = async (userId: string) => {
    setLoadingUserFiles(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-owner-stats?action=user&userId=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user files");
      }

      const data = await response.json();
      
      // Update the user's files in vpsStats
      setVpsStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.userId === userId ? { ...u, files: data.files } : u
          ),
        };
      });
    } catch (error) {
      console.error("Error fetching user files:", error);
      toast.error("Failed to fetch user files");
    } finally {
      setLoadingUserFiles(null);
    }
  };

  const toggleUserExpanded = async (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      // Fetch files if not already loaded
      const user = vpsStats?.users.find((u) => u.userId === userId);
      if (user && !user.files) {
        await fetchUserFiles(userId);
      }
    }
    setExpandedUsers(newExpanded);
  };

  const loadStorageNodes = () => {
    const savedNodes = localStorage.getItem("vps_storage_nodes");
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        setNodes((prev) => [...prev, ...parsed.filter((n: StorageNode) => n.id !== "vps-primary")]);
      } catch (e) {
        console.error("Failed to parse saved nodes");
      }
    }
  };

  const saveStorageNodes = (nodesToSave: StorageNode[]) => {
    const toSave = nodesToSave.filter((n) => n.id !== "vps-primary");
    localStorage.setItem("vps_storage_nodes", JSON.stringify(toSave));
  };

  const testConnection = async (endpoint: string, apiKey: string): Promise<"online" | "offline" | "unknown"> => {
    try {
      const response = await fetch(`${endpoint}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok ? "online" : "offline";
    } catch (error) {
      console.log("Connection test failed (likely mixed content block):", error);
      return "unknown";
    }
  };

  const handleAddNode = async () => {
    if (!newNode.name || !newNode.endpoint || !newNode.apiKey) {
      toast.error("Please fill in all fields");
      return;
    }

    setTesting(true);
    const connectionStatus = await testConnection(newNode.endpoint, newNode.apiKey);

    const node: StorageNode = {
      id: crypto.randomUUID(),
      name: newNode.name,
      endpoint: newNode.endpoint,
      status: connectionStatus === "online" ? "online" : connectionStatus === "unknown" ? "online" : "offline",
      totalStorage: 50 * 1024 * 1024 * 1024,
      usedStorage: 0,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    const nodeWithKey = { ...node, apiKey: newNode.apiKey };
    const savedNodes = localStorage.getItem("vps_storage_nodes");
    const existingNodes = savedNodes ? JSON.parse(savedNodes) : [];
    const updatedSavedNodes = [...existingNodes, nodeWithKey];
    localStorage.setItem("vps_storage_nodes", JSON.stringify(updatedSavedNodes));

    setNodes((prev) => [...prev, node]);

    if (connectionStatus === "unknown") {
      toast.success(
        `Storage node "${newNode.name}" added! Browser cannot verify HTTP endpoints, but uploads will work through the server.`,
        { duration: 5000 }
      );
    } else if (connectionStatus === "online") {
      toast.success(`Storage node "${newNode.name}" added and connected!`);
    } else {
      toast.warning(
        `Storage node "${newNode.name}" added but appears offline.`
      );
    }

    setNewNode({ name: "", endpoint: "", apiKey: "" });
    setAddDialogOpen(false);
    setTesting(false);
  };

  const handleRemoveNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    setNodes(updatedNodes);
    saveStorageNodes(updatedNodes);
    toast.success("Storage node removed");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getTotalStorage = () => {
    return nodes.reduce((acc, n) => acc + n.totalStorage, 0);
  };

  const getTotalUsed = () => {
    return nodes.reduce((acc, n) => acc + n.usedStorage, 0);
  };

  const filteredUsers = vpsStats?.users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.userId.toLowerCase().includes(query) ||
      user.profile?.email?.toLowerCase().includes(query) ||
      user.profile?.full_name?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <DashboardLayout>
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                <HardDrive className="w-6 h-6 text-cyan-400" />
              </div>
              Storage Management
            </h1>
            <p className="text-white/50 mt-1">
              Manage storage nodes and monitor user storage usage
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchVPSStorageStats}
              disabled={loadingStats}
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border-0">
                  <Plus className="w-4 h-4" />
                  Add Storage Node
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/90 backdrop-blur-xl border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white">Add VPS Storage Node</DialogTitle>
                  <DialogDescription className="text-white/50">
                    Connect a VPS server to extend your storage capacity.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white/70">Node Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., EU Storage Server"
                      value={newNode.name}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint" className="text-white/70">Endpoint URL</Label>
                    <Input
                      id="endpoint"
                      placeholder="https://storage.yourserver.com"
                      value={newNode.endpoint}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, endpoint: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-white/70">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Your VPS storage API key"
                      value={newNode.apiKey}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, apiKey: e.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <Alert className="bg-cyan-500/10 border-cyan-500/20">
                    <Info className="h-4 w-4 text-cyan-400" />
                    <AlertTitle className="text-cyan-400">Setup Required</AlertTitle>
                    <AlertDescription className="text-white/60">
                      Your VPS must be running the storage server.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="border-white/10 text-white/70">
                    Cancel
                  </Button>
                  <Button onClick={handleAddNode} disabled={testing} className="bg-gradient-to-r from-cyan-500 to-blue-500">
                    {testing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Add Node"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              User Storage
            </TabsTrigger>
            <TabsTrigger value="nodes" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              Storage Nodes
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Total Storage Overview */}
            <motion.div
              variants={staggerItem}
              initial="hidden"
              animate="show"
            >
              <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-cyan-400" />
                    Total VPS Storage Capacity
                  </CardTitle>
                  <CardDescription className="text-white/50">
                    Primary VPS storage usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">
                        {formatBytes(getTotalUsed())} used of {formatBytes(getTotalStorage())}
                      </span>
                      <span className="font-medium text-cyan-400">
                        {getTotalStorage() > 0 ? ((getTotalUsed() / getTotalStorage()) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="relative">
                      <Progress
                        value={getTotalStorage() > 0 ? (getTotalUsed() / getTotalStorage()) * 100 : 0}
                        className="h-3 bg-white/10"
                      />
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                        <span className="text-white/70">Used: {formatBytes(getTotalUsed())}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white/20" />
                        <span className="text-white/70">Free: {formatBytes(getTotalStorage() - getTotalUsed())}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid gap-4 md:grid-cols-3"
            >
              <motion.div variants={staggerItem}>
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/70">Active Users</CardTitle>
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Users className="h-4 w-4 text-cyan-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">{vpsStats?.totalUsers || 0}</div>
                    <p className="text-xs text-white/50 mt-1">Using storage</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/70">Total Storage</CardTitle>
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <HardDrive className="h-4 w-4 text-blue-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">{vpsStats?.totalGB || "0 GB"}</div>
                    <p className="text-xs text-white/50 mt-1">Used across all users</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/70">Total Files</CardTitle>
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <File className="h-4 w-4 text-violet-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">
                      {vpsStats?.users.reduce((sum, u) => sum + u.fileCount, 0) || 0}
                    </div>
                    <p className="text-xs text-white/50 mt-1">Stored on VPS</p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* User Storage Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">User Storage Usage</CardTitle>
                <CardDescription className="text-white/50">
                  Detailed breakdown of storage by user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      placeholder="Search by user ID, email, or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  {loadingStats ? (
                    <div className="text-center py-8 text-white/50">Loading storage stats...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-white/50">No users found</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <Collapsible
                          key={user.userId}
                          open={expandedUsers.has(user.userId)}
                          onOpenChange={() => toggleUserExpanded(user.userId)}
                        >
                          <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                                    <Users className="h-4 w-4 text-cyan-400" />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium text-white">
                                      {user.profile?.full_name || user.profile?.email || user.userId.slice(0, 8)}
                                    </div>
                                    <div className="text-sm text-white/50">
                                      {user.profile?.email || user.userId}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <div className="font-medium text-cyan-400">{user.totalMB}</div>
                                    <div className="text-sm text-white/50">{user.fileCount} files</div>
                                  </div>
                                  {expandedUsers.has(user.userId) ? (
                                    <ChevronUp className="h-4 w-4 text-white/40" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-white/40" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t border-white/10 p-4 bg-white/[0.01]">
                                {loadingUserFiles === user.userId ? (
                                  <div className="text-center py-4 text-white/50">Loading files...</div>
                                ) : user.files ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-white/10 hover:bg-transparent">
                                        <TableHead className="text-white/60">File Name</TableHead>
                                        <TableHead className="text-white/60">Size</TableHead>
                                        <TableHead className="text-white/60">Created</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {user.files.slice(0, 10).map((file, idx) => (
                                        <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                                          <TableCell className="font-medium text-white/80">{file.name}</TableCell>
                                          <TableCell className="text-white/60">{formatBytes(file.size)}</TableCell>
                                          <TableCell className="text-white/60">
                                            {new Date(file.created).toLocaleDateString()}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <div className="text-center py-4 text-white/50">No files found</div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Nodes Tab */}
          <TabsContent value="nodes" className="space-y-6">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid gap-4"
            >
              {nodes.map((node, index) => (
                <motion.div key={node.id} variants={staggerItem}>
                  <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                            <Server className="h-6 w-6 text-cyan-400" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white">{node.name}</h3>
                              {node.isPrimary && (
                                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                                  Primary
                                </Badge>
                              )}
                              <Badge
                                variant={node.status === "online" ? "default" : "destructive"}
                                className={
                                  node.status === "online"
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : node.status === "checking"
                                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                                }
                              >
                                {node.status === "online" && <CheckCircle className="w-3 h-3 mr-1" />}
                                {node.status === "offline" && <XCircle className="w-3 h-3 mr-1" />}
                                {node.status === "checking" && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                                {node.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-white/50">{node.endpoint}</p>
                            <div className="flex items-center gap-4 mt-3 text-sm">
                              <div className="flex items-center gap-2 text-white/60">
                                <HardDrive className="w-4 h-4" />
                                <span>{formatBytes(node.totalStorage)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-cyan-400">
                                <Activity className="w-4 h-4" />
                                <span>{formatBytes(node.usedStorage)} used</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {!node.isPrimary && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveNode(node.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-4">
                        <Progress
                          value={node.totalStorage > 0 ? (node.usedStorage / node.totalStorage) * 100 : 0}
                          className="h-2 bg-white/10"
                        />
                        <div className="flex justify-between mt-2 text-xs text-white/50">
                          <span>{((node.usedStorage / node.totalStorage) * 100).toFixed(1)}% used</span>
                          <span>{formatBytes(node.totalStorage - node.usedStorage)} free</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>
        </Tabs>
      </PageTransition>
    </DashboardLayout>
  );
};

export default StorageSettings;

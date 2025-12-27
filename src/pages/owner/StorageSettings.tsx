import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
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

// Hardcoded VPS configuration
const VPS_CONFIG = {
  endpoint: import.meta.env.VITE_VPS_STORAGE_ENDPOINT || "http://localhost:4000",
  apiKey: "kARTOOS007",
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

  const handlePreviewFile = async (file: { path: string; name: string; size: number }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-owner-file?path=${encodeURIComponent(
        file.path
      )}&action=get`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error("Error previewing file:", error);
      toast.error("Failed to preview file");
    }
  };

  const handleDownloadFile = async (file: { path: string; name: string; size: number }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-owner-file?path=${encodeURIComponent(
        file.path
      )}&action=get`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(blobUrl);
      toast.success(`Download started for ${file.name}`);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDeleteFile = async (userId: string, file: { path: string; name: string; size: number }) => {
    const confirmed = window.confirm(
      `Delete file "${file.name}" for this user? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-owner-file?path=${encodeURIComponent(
        file.path
      )}&action=delete`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete file");
      }

      // Update local stats to reflect deletion
      setVpsStats((prev) => {
        if (!prev) return prev;
        const users = prev.users.map((u) => {
          if (u.userId !== userId) return u;
          const files = (u.files || []).filter((f) => f.path !== file.path);
          const newTotalBytes = u.totalBytes - file.size;
          return {
            ...u,
            files,
            totalBytes: newTotalBytes,
            totalMB: (newTotalBytes / (1024 * 1024)).toFixed(2),
            fileCount: Math.max(0, u.fileCount - 1),
          };
        });
        const newTotalBytesGlobal = prev.totalBytes - file.size;
        return {
          ...prev,
          users,
          totalBytes: newTotalBytesGlobal,
          totalGB: (newTotalBytesGlobal / (1024 * 1024 * 1024)).toFixed(2),
        };
      });

      // Update node usage for primary VPS node
      setNodes((prev) =>
        prev.map((node) =>
          node.id === "vps-primary"
            ? {
                ...node,
                usedStorage: Math.max(0, node.usedStorage - file.size),
              }
            : node
        )
      );

      toast.success("File deleted");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <HardDrive className="w-6 h-6 text-primary" />
              Storage Management
            </h1>
            <p className="text-muted-foreground">
              Manage storage nodes and monitor user storage usage
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchVPSStorageStats}
              disabled={loadingStats}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Storage Node
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add VPS Storage Node</DialogTitle>
                  <DialogDescription>
                    Connect a VPS server to extend your storage capacity.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Node Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., EU Storage Server"
                      value={newNode.name}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint URL</Label>
                    <Input
                      id="endpoint"
                      placeholder="https://storage.yourserver.com"
                      value={newNode.endpoint}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, endpoint: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Your VPS storage API key"
                      value={newNode.apiKey}
                      onChange={(e) =>
                        setNewNode((prev) => ({ ...prev, apiKey: e.target.value }))
                      }
                    />
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Setup Required</AlertTitle>
                    <AlertDescription>
                      Your VPS must be running the storage server.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddNode} disabled={testing}>
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
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Storage</TabsTrigger>
            <TabsTrigger value="nodes">Storage Nodes</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Total Storage Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Total VPS Storage Capacity</CardTitle>
                <CardDescription>
                  Primary VPS storage usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatBytes(getTotalUsed())} used of {formatBytes(getTotalStorage())}
                    </span>
                    <span className="font-medium">
                      {getTotalStorage() > 0 ? ((getTotalUsed() / getTotalStorage()) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <Progress
                    value={getTotalStorage() > 0 ? (getTotalUsed() / getTotalStorage()) * 100 : 0}
                    className="h-3"
                  />
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span>Used: {formatBytes(getTotalUsed())}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted" />
                      <span>Free: {formatBytes(getTotalStorage() - getTotalUsed())}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{vpsStats?.totalUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <HardDrive className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Storage Used</p>
                      <p className="text-2xl font-bold">{vpsStats?.totalGB || "0"} GB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <File className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Files</p>
                      <p className="text-2xl font-bold">
                        {vpsStats?.users.reduce((acc, u) => acc + u.fileCount, 0) || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* User Storage Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Storage Usage</CardTitle>
                    <CardDescription>
                      View and manage storage for all users
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users with stored files found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <Collapsible
                        key={user.userId}
                        open={expandedUsers.has(user.userId)}
                        onOpenChange={() => toggleUserExpanded(user.userId)}
                      >
                        <div className="border rounded-lg">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                  {user.profile?.full_name?.[0]?.toUpperCase() || user.profile?.email?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {user.profile?.full_name || user.profile?.email || "Unknown User"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {user.profile?.email || user.userId}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="font-medium">{formatBytes(user.totalBytes)}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {user.fileCount} files
                                  </p>
                                </div>
                                <div className="w-32">
                                  <Progress
                                    value={Math.min((user.totalBytes / (1024 * 1024 * 1024)) * 10, 100)}
                                    className="h-2"
                                  />
                                </div>
                                {expandedUsers.has(user.userId) ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t px-4 py-3 bg-muted/30">
                              {loadingUserFiles === user.userId ? (
                                <div className="flex items-center justify-center py-4">
                                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : user.files && user.files.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Filename</TableHead>
                                      <TableHead>Size</TableHead>
                                      <TableHead>Created</TableHead>
                                      <TableHead>Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.files.map((file) => (
                                      <TableRow key={file.path}>
                                        <TableCell className="font-mono text-sm">
                                          {file.name}
                                        </TableCell>
                                        <TableCell>{formatBytes(file.size)}</TableCell>
                                        <TableCell>
                                          {new Date(file.created).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handlePreviewFile(file)}
                                            >
                                              <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDownloadFile(file)}
                                            >
                                              <Download className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDeleteFile(user.userId, file)}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No file details available
                                </p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nodes.map((node, index) => (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                >
                  <Card className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              node.isPrimary
                                ? "bg-violet-500/20 text-violet-500"
                                : "bg-primary/20 text-primary"
                            }`}
                          >
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{node.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {node.endpoint}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {node.isPrimary && (
                            <Badge className="text-xs bg-violet-500">Primary</Badge>
                          )}
                          <Badge
                            variant={node.status === "online" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {node.status === "checking" ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : node.status === "online" ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {node.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Storage Used</span>
                            <span className="font-medium">
                              {formatBytes(node.usedStorage)} / {formatBytes(node.totalStorage)}
                            </span>
                          </div>
                          <Progress
                            value={node.totalStorage > 0 ? (node.usedStorage / node.totalStorage) * 100 : 0}
                            className="h-2"
                          />
                        </div>
                        {!node.isPrimary && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleRemoveNode(node.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default StorageSettings;
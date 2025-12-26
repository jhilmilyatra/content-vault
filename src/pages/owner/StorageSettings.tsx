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

interface StorageNode {
  id: string;
  name: string;
  endpoint: string;
  status: "online" | "offline" | "checking";
  totalStorage: number;
  usedStorage: number;
  isDefault: boolean;
  createdAt: string;
}

const StorageSettings = () => {
  const [nodes, setNodes] = useState<StorageNode[]>([
    {
      id: "default",
      name: "Primary Storage (Supabase)",
      endpoint: "Built-in",
      status: "online",
      totalStorage: 5 * 1024 * 1024 * 1024, // 5GB
      usedStorage: 0,
      isDefault: true,
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

  useEffect(() => {
    fetchStorageStats();
    loadStorageNodes();
  }, []);

  const fetchStorageStats = async () => {
    try {
      const { data: metrics } = await supabase
        .from("usage_metrics")
        .select("storage_used_bytes");

      const totalUsed = metrics?.reduce((acc, m) => acc + Number(m.storage_used_bytes), 0) || 0;

      setNodes((prev) =>
        prev.map((node) =>
          node.id === "default" ? { ...node, usedStorage: totalUsed } : node
        )
      );
    } catch (error) {
      console.error("Error fetching storage stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageNodes = () => {
    // Load saved nodes from localStorage (in production, this would be from database)
    const savedNodes = localStorage.getItem("vps_storage_nodes");
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        setNodes((prev) => [prev[0], ...parsed]);
      } catch (e) {
        console.error("Failed to parse saved nodes");
      }
    }
  };

  const saveStorageNodes = (nodesToSave: StorageNode[]) => {
    // Save non-default nodes to localStorage
    const toSave = nodesToSave.filter((n) => n.id !== "default");
    localStorage.setItem("vps_storage_nodes", JSON.stringify(toSave));
  };

  const testConnection = async (endpoint: string, apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch(`${endpoint}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const handleAddNode = async () => {
    if (!newNode.name || !newNode.endpoint || !newNode.apiKey) {
      toast.error("Please fill in all fields");
      return;
    }

    setTesting(true);

    // Test the connection
    const isOnline = await testConnection(newNode.endpoint, newNode.apiKey);

    const node: StorageNode = {
      id: crypto.randomUUID(),
      name: newNode.name,
      endpoint: newNode.endpoint,
      status: isOnline ? "online" : "offline",
      totalStorage: 50 * 1024 * 1024 * 1024, // Default 50GB
      usedStorage: 0,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    const updatedNodes = [...nodes, node];
    setNodes(updatedNodes);
    saveStorageNodes(updatedNodes);

    // Save to Supabase secrets (note: this requires edge function in production)
    toast.success(
      isOnline
        ? `Storage node "${newNode.name}" added and connected!`
        : `Storage node "${newNode.name}" added but appears offline. Check the endpoint.`
    );

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

  const handleRefreshStatus = async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.id === "default") return;

    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, status: "checking" } : n))
    );

    // In production, retrieve API key from secure storage
    const savedNodes = localStorage.getItem("vps_storage_nodes");
    let apiKey = "";
    if (savedNodes) {
      const parsed = JSON.parse(savedNodes);
      const savedNode = parsed.find((n: any) => n.id === nodeId);
      apiKey = savedNode?.apiKey || "";
    }

    const isOnline = await testConnection(node.endpoint, apiKey);

    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, status: isOnline ? "online" : "offline" } : n
      )
    );

    toast.info(`Node status: ${isOnline ? "Online" : "Offline"}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 GB";
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2) + " GB";
  };

  const getTotalStorage = () => {
    return nodes.reduce((acc, n) => acc + n.totalStorage, 0);
  };

  const getTotalUsed = () => {
    return nodes.reduce((acc, n) => acc + n.usedStorage, 0);
  };

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
              Manage storage nodes and extend capacity
            </p>
          </div>
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
                  Connect a VPS server to extend your storage capacity. The server
                  must be running the storage API.
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
                    Your VPS must be running the storage server. See the README for
                    setup instructions.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
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

        {/* Total Storage Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Total Storage Capacity</CardTitle>
            <CardDescription>
              Combined storage from all connected nodes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(getTotalUsed())} used of {formatBytes(getTotalStorage())}
                </span>
                <span className="font-medium">
                  {((getTotalUsed() / getTotalStorage()) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={(getTotalUsed() / getTotalStorage()) * 100}
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

        {/* Storage Nodes List */}
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
                          node.isDefault
                            ? "bg-primary/20 text-primary"
                            : "bg-violet-500/20 text-violet-500"
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
                      {node.isDefault ? (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRefreshStatus(node.id)}
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${
                                node.status === "checking" ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveNode(node.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {node.status === "online" ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-emerald-500">Online</span>
                      </>
                    ) : node.status === "checking" ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                        <span className="text-sm text-amber-500">Checking...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">Offline</span>
                      </>
                    )}
                  </div>

                  {/* Storage Usage */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Storage</span>
                      <span>
                        {formatBytes(node.usedStorage)} / {formatBytes(node.totalStorage)}
                      </span>
                    </div>
                    <Progress
                      value={(node.usedStorage / node.totalStorage) * 100}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              • Additional storage nodes require running a compatible storage server on your VPS
            </p>
            <p className="text-sm text-muted-foreground">
              • Ensure your VPS has HTTPS enabled for secure file transfers
            </p>
            <p className="text-sm text-muted-foreground">
              • Files are automatically distributed across available nodes
            </p>
            <p className="text-sm text-muted-foreground">
              • See the README for detailed VPS storage server setup instructions
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StorageSettings;

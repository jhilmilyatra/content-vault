import { useState, useEffect, useCallback } from "react";

export interface StorageNode {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  status: "online" | "offline" | "checking";
  totalStorage: number;
  usedStorage: number;
  isDefault: boolean;
  priority: number;
}

interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  fileCount: number;
  usagePercent: string;
}

const STORAGE_NODES_KEY = "vps_storage_nodes";
const PRIMARY_NODE_KEY = "primary_storage_node";

export const useStorageNodes = () => {
  const [nodes, setNodes] = useState<StorageNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Load nodes from localStorage
  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = () => {
    try {
      const saved = localStorage.getItem(STORAGE_NODES_KEY);
      if (saved) {
        setNodes(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load storage nodes:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveNodes = useCallback((nodesToSave: StorageNode[]) => {
    localStorage.setItem(STORAGE_NODES_KEY, JSON.stringify(nodesToSave));
    setNodes(nodesToSave);
  }, []);

  const addNode = useCallback(async (node: Omit<StorageNode, "id" | "status" | "totalStorage" | "usedStorage">): Promise<StorageNode> => {
    const newNode: StorageNode = {
      ...node,
      id: crypto.randomUUID(),
      status: "checking",
      totalStorage: 0,
      usedStorage: 0,
    };

    // Test connection and get stats
    const stats = await checkNodeHealth(newNode.endpoint, newNode.apiKey);
    
    newNode.status = stats ? "online" : "offline";
    if (stats) {
      newNode.totalStorage = stats.totalBytes;
      newNode.usedStorage = stats.usedBytes;
    }

    const updatedNodes = [...nodes, newNode];
    saveNodes(updatedNodes);
    
    return newNode;
  }, [nodes, saveNodes]);

  const removeNode = useCallback((nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    saveNodes(updatedNodes);
  }, [nodes, saveNodes]);

  const updateNodeStatus = useCallback(async (nodeId: string): Promise<"online" | "offline"> => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return "offline";

    const stats = await checkNodeHealth(node.endpoint, node.apiKey);
    const status: "online" | "offline" = stats ? "online" : "offline";

    const updatedNodes: StorageNode[] = nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            status: status as "online" | "offline",
            totalStorage: stats?.totalBytes || n.totalStorage,
            usedStorage: stats?.usedBytes || n.usedStorage,
          }
        : n
    );

    saveNodes(updatedNodes);
    return status;
  }, [nodes, saveNodes]);

  const setPrimaryNode = useCallback((nodeId: string) => {
    localStorage.setItem(PRIMARY_NODE_KEY, nodeId);
  }, []);

  const getPrimaryNode = useCallback((): StorageNode | null => {
    const primaryId = localStorage.getItem(PRIMARY_NODE_KEY);
    if (primaryId) {
      const primary = nodes.find((n) => n.id === primaryId && n.status === "online");
      if (primary) return primary;
    }
    // Return first online node
    return nodes.find((n) => n.status === "online") || null;
  }, [nodes]);

  /**
   * Get the best node for upload based on:
   * 1. Priority setting
   * 2. Available capacity
   * 3. Online status
   */
  const getBestNodeForUpload = useCallback((fileSize: number): StorageNode | null => {
    const onlineNodes = nodes
      .filter((n) => n.status === "online")
      .filter((n) => n.totalStorage - n.usedStorage > fileSize)
      .sort((a, b) => {
        // First by priority
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by available space
        const aFree = a.totalStorage - a.usedStorage;
        const bFree = b.totalStorage - b.usedStorage;
        return bFree - aFree;
      });

    return onlineNodes[0] || null;
  }, [nodes]);

  /**
   * Get all online nodes sorted by priority
   */
  const getOnlineNodes = useCallback((): StorageNode[] => {
    return nodes
      .filter((n) => n.status === "online")
      .sort((a, b) => a.priority - b.priority);
  }, [nodes]);

  /**
   * Check if VPS storage is configured
   */
  const hasVPSStorage = useCallback((): boolean => {
    return nodes.some((n) => n.status === "online");
  }, [nodes]);

  return {
    nodes,
    loading,
    addNode,
    removeNode,
    updateNodeStatus,
    setPrimaryNode,
    getPrimaryNode,
    getBestNodeForUpload,
    getOnlineNodes,
    hasVPSStorage,
    saveNodes,
  };
};

/**
 * Check node health and get storage stats
 */
async function checkNodeHealth(endpoint: string, apiKey: string): Promise<StorageStats | null> {
  try {
    const response = await fetch(`${endpoint}/health`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.storage || null;
  } catch (error) {
    console.error("Health check failed:", error);
    return null;
  }
}

/**
 * Upload file to VPS storage node
 */
export async function uploadToVPS(
  node: StorageNode,
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);

  const response = await fetch(`${node.endpoint}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${node.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`VPS upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (onProgress) onProgress(100);

  return {
    path: result.path,
    url: `${node.endpoint}/files/${result.path}`,
  };
}

/**
 * Delete file from VPS storage
 */
export async function deleteFromVPS(
  node: StorageNode,
  storagePath: string
): Promise<boolean> {
  try {
    const response = await fetch(`${node.endpoint}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${node.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: storagePath }),
    });

    return response.ok;
  } catch (error) {
    console.error("VPS delete failed:", error);
    return false;
  }
}

/**
 * Get file URL from VPS storage
 */
export function getVPSFileUrl(node: StorageNode, storagePath: string): string {
  return `${node.endpoint}/files/${storagePath}`;
}

export default useStorageNodes;

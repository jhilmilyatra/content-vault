import { supabase } from "@/integrations/supabase/client";

export interface FileItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  thumbnail_url: string | null;
  description: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  fileName: string;
  status: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
}

// Hardcoded primary VPS configuration - always available
const PRIMARY_VPS_CONFIG = {
  endpoint: "http://46.38.232.46:4000",
  apiKey: "kARTOOS007",
};

const STORAGE_NODES_KEY = "vps_storage_nodes";

/**
 * Get all configured VPS storage nodes (includes hardcoded primary)
 */
export const getStorageNodes = (): StorageNode[] => {
  // Always include the primary VPS node
  const primaryNode: StorageNode = {
    id: "vps-primary",
    name: "Primary VPS Storage",
    endpoint: PRIMARY_VPS_CONFIG.endpoint,
    apiKey: PRIMARY_VPS_CONFIG.apiKey,
    status: "online",
    totalStorage: 200 * 1024 * 1024 * 1024, // 200GB
    usedStorage: 0,
    isDefault: true,
    priority: 1,
  };

  try {
    const saved = localStorage.getItem(STORAGE_NODES_KEY);
    if (saved) {
      const additionalNodes = JSON.parse(saved) as StorageNode[];
      // Filter out any duplicate primary node
      const filtered = additionalNodes.filter(n => n.id !== "vps-primary");
      return [primaryNode, ...filtered];
    }
  } catch (e) {
    console.error("Failed to load storage nodes:", e);
  }
  return [primaryNode];
};

/**
 * Get the primary VPS config (hardcoded)
 */
export const getPrimaryVPSConfig = () => PRIMARY_VPS_CONFIG;

/**
 * Get the best available VPS node for upload based on capacity
 */
export const getBestVPSNode = (fileSize: number): StorageNode | null => {
  const nodes = getStorageNodes();
  
  const availableNodes = nodes
    .filter((n) => n.status === "online")
    .filter((n) => n.totalStorage - n.usedStorage > fileSize)
    .sort((a, b) => {
      // First by priority (lower is better)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by available space (more is better)
      const aFree = a.totalStorage - a.usedStorage;
      const bFree = b.totalStorage - b.usedStorage;
      return bFree - aFree;
    });

  return availableNodes[0] || null;
};

/**
 * Check if VPS storage is available
 */
export const hasVPSStorage = (): boolean => {
  // Always true since primary VPS is hardcoded
  return true;
};

/**
 * Upload file with real progress tracking using XMLHttpRequest
 */
const uploadToVPSWithProgress = (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress) => void
): Promise<FileItem> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get auth session for edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        reject(new Error("Not authenticated"));
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      if (folderId) {
        formData.append("folderId", folderId);
      }

      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const loadedDiff = event.loaded - lastLoaded;
          
          // Calculate speed (bytes per second)
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
          
          // Calculate remaining time
          const remaining = event.total - event.loaded;
          const remainingTime = speed > 0 ? remaining / speed : 0;
          
          lastLoaded = event.loaded;
          lastTime = now;

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            speed,
            remainingTime,
            fileName: file.name,
            status: 'uploading'
          });
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (onProgress) {
              onProgress({
                loaded: file.size,
                total: file.size,
                percentage: 100,
                speed: 0,
                remainingTime: 0,
                fileName: file.name,
                status: 'complete'
              });
            }
            resolve(result.file as FileItem);
          } catch (e) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.error || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        if (onProgress) {
          onProgress({
            loaded: 0,
            total: file.size,
            percentage: 0,
            speed: 0,
            remainingTime: 0,
            fileName: file.name,
            status: 'error'
          });
        }
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload aborted"));
      });

      // Initial progress - preparing
      if (onProgress) {
        onProgress({
          loaded: 0,
          total: file.size,
          percentage: 0,
          speed: 0,
          remainingTime: 0,
          fileName: file.name,
          status: 'preparing'
        });
      }

      // Open and send request
      xhr.open("POST", `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${sessionData.session.access_token}`);
      xhr.send(formData);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Upload file - uses edge function for VPS upload with progress tracking
 */
export const uploadFile = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress | number) => void
): Promise<FileItem> => {
  console.log("📦 Uploading via edge function to VPS");
  
  // Wrap the progress callback to handle both old and new formats
  const progressHandler = onProgress ? (progress: UploadProgress) => {
    // For backwards compatibility, also support simple number callback
    if (typeof onProgress === 'function') {
      onProgress(progress);
    }
  } : undefined;
  
  return await uploadToVPSWithProgress(file, userId, folderId, progressHandler);
};

/**
 * Update node usage in localStorage
 */
const updateNodeUsage = (nodeId: string, bytesAdded: number) => {
  try {
    const nodes = getStorageNodes();
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, usedStorage: n.usedStorage + bytesAdded }
        : n
    );
    localStorage.setItem(STORAGE_NODES_KEY, JSON.stringify(updatedNodes));
  } catch (e) {
    console.error("Failed to update node usage:", e);
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  userId: string,
  folderId: string | null,
  onProgress?: (fileIndex: number, progress: UploadProgress | number) => void
): Promise<FileItem[]> => {
  const results: FileItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadFile(file, userId, folderId, (progress) => {
      if (onProgress) onProgress(i, progress);
    });
    results.push(result);
  }

  return results;
};

export const deleteFile = async (fileId: string, storagePath: string): Promise<void> => {
  // Soft delete in database
  const { error: dbError } = await supabase
    .from("files")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", fileId);

  if (dbError) throw dbError;
};

export const permanentDeleteFile = async (fileId: string, storagePath: string): Promise<void> => {
  // Try to delete from VPS first
  const nodes = getStorageNodes();
  for (const node of nodes) {
    if (node.status === "online") {
      try {
        await fetch(`${node.endpoint}/delete`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${node.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: storagePath }),
        });
      } catch (e) {
        console.error("VPS delete error:", e);
      }
    }
  }

  // Delete from Supabase storage (fallback)
  const { error: storageError } = await supabase.storage
    .from("user-files")
    .remove([storagePath]);

  if (storageError) {
    console.error("Supabase storage delete error:", storageError);
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId);

  if (dbError) throw dbError;
};

export const restoreFile = async (fileId: string): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", fileId);

  if (error) throw error;
};

export const getFileUrl = async (storagePath: string): Promise<string> => {
  // Use edge function to get file URL (avoids mixed content issues)
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=url`,
    {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get file URL");
  }

  const result = await response.json();
  
  // If VPS URL, proxy through edge function for HTTPS
  if (result.storage === "vps") {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=get`;
  }
  
  return result.url;
};

export const createFolder = async (
  userId: string,
  name: string,
  parentId: string | null
): Promise<FolderItem> => {
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) throw error;

  return data as FolderItem;
};

export const renameFolder = async (folderId: string, newName: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .update({ name: newName })
    .eq("id", folderId);

  if (error) throw error;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", folderId);

  if (error) throw error;
};

export const renameFile = async (fileId: string, newName: string): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ name: newName })
    .eq("id", fileId);

  if (error) throw error;
};

export const moveFile = async (fileId: string, newFolderId: string | null): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ folder_id: newFolderId })
    .eq("id", fileId);

  if (error) throw error;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const formatTime = (seconds: number): string => {
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "archive";
  if (mimeType.includes("word") || mimeType.includes("document")) return "document";
  return "file";
};
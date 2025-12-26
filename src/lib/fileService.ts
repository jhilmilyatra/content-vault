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

const STORAGE_NODES_KEY = "vps_storage_nodes";

/**
 * Get all configured VPS storage nodes
 */
export const getStorageNodes = (): StorageNode[] => {
  try {
    const saved = localStorage.getItem(STORAGE_NODES_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load storage nodes:", e);
  }
  return [];
};

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
  const nodes = getStorageNodes();
  return nodes.some((n) => n.status === "online");
};

/**
 * Upload file to VPS storage directly
 */
const uploadToVPS = async (
  node: StorageNode,
  file: File,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ path: string; url: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("userId", userId);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve({
            path: result.path,
            url: `${node.endpoint}/files/${result.path}`,
          });
        } catch (e) {
          reject(new Error("Invalid response from VPS"));
        }
      } else {
        reject(new Error(`VPS upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("VPS upload failed: Network error"));
    });

    xhr.open("POST", `${node.endpoint}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${node.apiKey}`);
    xhr.send(formData);
  });
};

/**
 * Upload file - automatically routes to VPS if available, falls back to Supabase
 */
export const uploadFile = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: number) => void
): Promise<FileItem> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const storagePath = `${userId}/${fileName}`;

  // Check for VPS storage first
  const vpsNode = getBestVPSNode(file.size);

  if (vpsNode) {
    // Upload to VPS
    console.log(`📦 Uploading to VPS: ${vpsNode.name}`);
    
    try {
      await uploadToVPS(vpsNode, file, userId, onProgress);

      // Create file record in Supabase (metadata only)
      const { data, error } = await supabase
        .from("files")
        .insert({
          user_id: userId,
          folder_id: folderId,
          name: file.name,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (error) throw error;

      // Update node usage
      updateNodeUsage(vpsNode.id, file.size);

      return data as FileItem;
    } catch (vpsError) {
      console.error("VPS upload failed, falling back to cloud:", vpsError);
      // Fall through to Supabase upload
    }
  }

  // Fallback: Upload to Supabase storage
  console.log("☁️ Uploading to cloud storage");
  
  const { error: uploadError } = await supabase.storage
    .from("user-files")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Create file record
  const { data, error } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      folder_id: folderId,
      name: file.name,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) throw error;

  if (onProgress) onProgress(100);

  return data as FileItem;
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
  onProgress?: (fileIndex: number, progress: number) => void
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
  // Try VPS first
  const nodes = getStorageNodes();
  for (const node of nodes) {
    if (node.status === "online") {
      // Check if file exists on this node
      const vpsUrl = `${node.endpoint}/files/${storagePath}`;
      try {
        const response = await fetch(vpsUrl, { method: "HEAD" });
        if (response.ok) {
          return vpsUrl;
        }
      } catch (e) {
        // Node might be down or file not on this node
      }
    }
  }

  // Fallback to Supabase
  const { data } = await supabase.storage
    .from("user-files")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (!data?.signedUrl) throw new Error("Failed to get file URL");

  return data.signedUrl;
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

export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "archive";
  if (mimeType.includes("word") || mimeType.includes("document")) return "document";
  return "file";
};

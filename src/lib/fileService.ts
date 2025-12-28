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
  status: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error' | 'paused';
  chunked?: boolean;
  currentChunk?: number;
  totalChunks?: number;
  uploadId?: string;
}

export interface ChunkedUploadState {
  uploadId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  folderId: string | null;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: string;
}

// Chunk size: 10MB (larger chunks = fewer requests = faster upload)
const CHUNK_SIZE = 10 * 1024 * 1024;

// Threshold for chunked upload: 50MB (lower threshold for better reliability)
const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024;

// Parallel chunk uploads (upload multiple chunks simultaneously)
const PARALLEL_CHUNKS = 3;

// Storage key for resumable uploads
const RESUMABLE_UPLOADS_KEY = "resumable_uploads";

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
 * Get saved resumable uploads from localStorage
 */
export const getResumableUploads = (): ChunkedUploadState[] => {
  try {
    const saved = localStorage.getItem(RESUMABLE_UPLOADS_KEY);
    if (saved) {
      return JSON.parse(saved) as ChunkedUploadState[];
    }
  } catch (e) {
    console.error("Failed to load resumable uploads:", e);
  }
  return [];
};

/**
 * Save resumable upload state to localStorage
 */
const saveResumableUpload = (state: ChunkedUploadState) => {
  try {
    const uploads = getResumableUploads();
    const existing = uploads.findIndex(u => u.uploadId === state.uploadId);
    if (existing >= 0) {
      uploads[existing] = state;
    } else {
      uploads.push(state);
    }
    localStorage.setItem(RESUMABLE_UPLOADS_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error("Failed to save resumable upload:", e);
  }
};

/**
 * Remove resumable upload from localStorage
 */
const removeResumableUpload = (uploadId: string) => {
  try {
    const uploads = getResumableUploads().filter(u => u.uploadId !== uploadId);
    localStorage.setItem(RESUMABLE_UPLOADS_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error("Failed to remove resumable upload:", e);
  }
};

/**
 * Clear all expired resumable uploads (older than 24 hours)
 */
export const clearExpiredResumableUploads = () => {
  try {
    const now = Date.now();
    const uploads = getResumableUploads().filter(u => {
      const createdAt = new Date(u.createdAt).getTime();
      return now - createdAt < 24 * 60 * 60 * 1000;
    });
    localStorage.setItem(RESUMABLE_UPLOADS_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error("Failed to clear expired uploads:", e);
  }
};

/**
 * Upload large file in chunks with resume capability
 */
const uploadChunked = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress) => void,
  existingUploadId?: string
): Promise<FileItem> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Not authenticated");
  }

  const accessToken = sessionData.session.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  let uploadId = existingUploadId;
  let uploadedChunks: number[] = [];

  // Initialize or resume upload
  if (!uploadId) {
    // Initialize new chunked upload
    if (onProgress) {
      onProgress({
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        remainingTime: 0,
        fileName: file.name,
        status: 'preparing',
        chunked: true,
        currentChunk: 0,
        totalChunks,
      });
    }

    const initResponse = await fetch(
      `${supabaseUrl}/functions/v1/vps-chunked-upload?action=init`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          totalSize: file.size,
          totalChunks,
          folderId,
        }),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error || "Failed to initialize upload");
    }

    const initResult = await initResponse.json();
    uploadId = initResult.uploadId;

    // Save to localStorage for resume capability
    saveResumableUpload({
      uploadId: uploadId!,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      folderId,
      totalChunks,
      uploadedChunks: [],
      createdAt: new Date().toISOString(),
    });
  } else {
    // Resume existing upload - get status
    const statusResponse = await fetch(
      `${supabaseUrl}/functions/v1/vps-chunked-upload?action=status&uploadId=${uploadId}`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      uploadedChunks = statusResult.uploadedChunks || [];
      console.log(`📦 Resuming upload: ${uploadedChunks.length}/${totalChunks} chunks already uploaded`);
    }
  }

  // Upload chunks in parallel for better speed
  const startTime = Date.now();
  let totalUploaded = uploadedChunks.reduce((acc, idx) => {
    const chunkStart = idx * CHUNK_SIZE;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
    return acc + (chunkEnd - chunkStart);
  }, 0);

  // Get remaining chunks to upload
  const remainingChunks = Array.from({ length: totalChunks }, (_, i) => i)
    .filter(i => !uploadedChunks.includes(i));

  // Upload chunks in parallel batches
  for (let batchStart = 0; batchStart < remainingChunks.length; batchStart += PARALLEL_CHUNKS) {
    const batch = remainingChunks.slice(batchStart, batchStart + PARALLEL_CHUNKS);
    
    // Update progress before batch
    if (onProgress) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = totalUploaded > 0 && elapsed > 0 ? totalUploaded / elapsed : 0;
      const remaining = file.size - totalUploaded;
      const remainingTime = speed > 0 ? remaining / speed : 0;

      onProgress({
        loaded: totalUploaded,
        total: file.size,
        percentage: Math.round((totalUploaded / file.size) * 100),
        speed,
        remainingTime,
        fileName: file.name,
        status: 'uploading',
        chunked: true,
        currentChunk: uploadedChunks.length + 1,
        totalChunks,
        uploadId,
      });
    }

    // Upload batch in parallel
    const batchPromises = batch.map(async (chunkIndex) => {
      const chunkStart = chunkIndex * CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
      const chunk = file.slice(chunkStart, chunkEnd);
      const chunkSize = chunkEnd - chunkStart;

      const formData = new FormData();
      formData.append("chunk", new Blob([chunk]));
      formData.append("uploadId", uploadId!);
      formData.append("chunkIndex", String(chunkIndex));

      const chunkResponse = await fetch(
        `${supabaseUrl}/functions/v1/vps-chunked-upload?action=chunk`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}` },
          body: formData,
        }
      );

      if (!chunkResponse.ok) {
        const error = await chunkResponse.json();
        throw new Error(error.error || `Failed to upload chunk ${chunkIndex}`);
      }

      return { chunkIndex, chunkSize };
    });

    // Wait for all chunks in batch to complete
    const results = await Promise.all(batchPromises);
    
    // Update tracking
    for (const { chunkIndex, chunkSize } of results) {
      totalUploaded += chunkSize;
      uploadedChunks.push(chunkIndex);
    }

    // Update localStorage after each batch
    const existingState = getResumableUploads().find(u => u.uploadId === uploadId);
    if (existingState) {
      saveResumableUpload({ ...existingState, uploadedChunks });
    }
  }

  // Finalize upload
  if (onProgress) {
    onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 99,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'processing',
      chunked: true,
      currentChunk: totalChunks,
      totalChunks,
      uploadId,
    });
  }

  const finalizeResponse = await fetch(
    `${supabaseUrl}/functions/v1/vps-chunked-upload?action=finalize`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uploadId }),
    }
  );

  if (!finalizeResponse.ok) {
    const error = await finalizeResponse.json();
    throw new Error(error.error || "Failed to finalize upload");
  }

  const result = await finalizeResponse.json();

  // Clean up localStorage
  removeResumableUpload(uploadId!);

  if (onProgress) {
    onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'complete',
      chunked: true,
      currentChunk: totalChunks,
      totalChunks,
      uploadId,
    });
  }

  return result.file as FileItem;
};

/**
 * Upload file - uses chunked upload for large files, regular upload for small files
 */
export const uploadFile = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress | number) => void,
  resumeUploadId?: string
): Promise<FileItem> => {
  // Wrap the progress callback to handle both old and new formats
  const progressHandler = onProgress ? (progress: UploadProgress) => {
    if (typeof onProgress === 'function') {
      onProgress(progress);
    }
  } : undefined;

  // Use chunked upload for large files (>100MB) or when resuming
  if (file.size > CHUNKED_UPLOAD_THRESHOLD || resumeUploadId) {
    console.log(`📦 Using chunked upload for ${file.name} (${formatFileSize(file.size)})`);
    return await uploadChunked(file, userId, folderId, progressHandler, resumeUploadId);
  }
  
  console.log(`📦 Uploading via edge function to VPS`);
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
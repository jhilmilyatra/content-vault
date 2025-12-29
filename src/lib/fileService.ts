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

// Speed history data point for graph visualization
export interface SpeedDataPoint {
  timestamp: number;
  speed: number; // bytes per second
  chunkSize?: number;
  parallelChunks?: number;
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
  // Adaptive speed settings
  adaptiveChunkSize?: number;
  adaptiveParallelChunks?: number;
  // Speed history for graph visualization
  speedHistory?: SpeedDataPoint[];
  // Chunk status visualization
  uploadedChunks?: number[];
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

// Adaptive chunk size configuration
const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB minimum
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB maximum
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB default
const SPEED_TEST_SIZE = 256 * 1024; // 256KB for speed test

// Target chunk upload time (seconds) - aim for 3-5 second chunks
const TARGET_CHUNK_TIME = 4;

// Threshold for chunked upload: 20MB
const CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024;

// Parallel chunk uploads - adjusted based on speed
const MIN_PARALLEL_CHUNKS = 2;
const MAX_PARALLEL_CHUNKS = 8;
const DEFAULT_PARALLEL_CHUNKS = 4;

// Parallel file uploads for batch uploads
const PARALLEL_FILES = 3;

// Storage key for resumable uploads
const RESUMABLE_UPLOADS_KEY = "resumable_uploads";

// Connection speed cache
interface SpeedProfile {
  bytesPerSecond: number;
  optimalChunkSize: number;
  optimalParallelChunks: number;
  measuredAt: number;
}

let cachedSpeedProfile: SpeedProfile | null = null;
const SPEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Estimate speed based on Network Information API or defaults
 */
const estimateSpeedFromConnection = (): number => {
  const connection = (navigator as any).connection;
  
  if (connection?.downlink) {
    // downlink is in Mbps, convert to bytes/second (upload ~15% of download)
    const estimatedUploadMbps = connection.downlink * 0.15;
    return estimatedUploadMbps * 1024 * 1024 / 8;
  }
  
  if (connection?.effectiveType) {
    const speedMap: Record<string, number> = {
      'slow-2g': 50 * 1024,
      '2g': 150 * 1024,
      '3g': 750 * 1024,
      '4g': 4 * 1024 * 1024,
    };
    return speedMap[connection.effectiveType] || 1 * 1024 * 1024;
  }
  
  return 1 * 1024 * 1024; // Default 1 MB/s
};

/**
 * Calculate optimal chunk size based on upload speed
 */
const calculateOptimalChunkSize = (bytesPerSecond: number): number => {
  const optimalSize = bytesPerSecond * TARGET_CHUNK_TIME;
  return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, optimalSize));
};

/**
 * Calculate optimal parallel chunks based on speed
 */
const calculateOptimalParallelChunks = (bytesPerSecond: number): number => {
  if (bytesPerSecond > 10 * 1024 * 1024) return MAX_PARALLEL_CHUNKS;
  if (bytesPerSecond > 5 * 1024 * 1024) return 6;
  if (bytesPerSecond > 2 * 1024 * 1024) return 4;
  if (bytesPerSecond > 500 * 1024) return 3;
  return MIN_PARALLEL_CHUNKS;
};

/**
 * Get speed profile with caching (uses Network API estimate first, refines during upload)
 */
const getSpeedProfile = (): SpeedProfile => {
  const now = Date.now();
  
  if (cachedSpeedProfile && (now - cachedSpeedProfile.measuredAt) < SPEED_CACHE_TTL) {
    return cachedSpeedProfile;
  }
  
  const bytesPerSecond = estimateSpeedFromConnection();
  cachedSpeedProfile = {
    bytesPerSecond,
    optimalChunkSize: calculateOptimalChunkSize(bytesPerSecond),
    optimalParallelChunks: calculateOptimalParallelChunks(bytesPerSecond),
    measuredAt: now,
  };
  
  console.log(`📊 Speed profile: ${formatFileSize(bytesPerSecond)}/s, chunk: ${formatFileSize(cachedSpeedProfile.optimalChunkSize)}, parallel: ${cachedSpeedProfile.optimalParallelChunks}`);
  return cachedSpeedProfile;
};

/**
 * Adaptive speed tracker for real-time adjustment during upload
 */
class AdaptiveSpeedTracker {
  private samples: { bytes: number; time: number }[] = [];
  private maxSamples = 10;
  private currentChunkSize: number;
  private currentParallelChunks: number;
  private speedHistory: SpeedDataPoint[] = [];
  private maxHistoryPoints = 50; // Keep last 50 data points for graph

  constructor(initialChunkSize: number = DEFAULT_CHUNK_SIZE, initialParallelChunks: number = DEFAULT_PARALLEL_CHUNKS) {
    this.currentChunkSize = initialChunkSize;
    this.currentParallelChunks = initialParallelChunks;
  }

  addSample(bytes: number, durationMs: number) {
    this.samples.push({ bytes, time: durationMs });
    if (this.samples.length > this.maxSamples) this.samples.shift();
    this.recalculate();
    
    // Add to speed history for graph
    const currentSpeed = this.getEstimatedSpeed();
    this.speedHistory.push({
      timestamp: Date.now(),
      speed: currentSpeed,
      chunkSize: this.currentChunkSize,
      parallelChunks: this.currentParallelChunks,
    });
    if (this.speedHistory.length > this.maxHistoryPoints) {
      this.speedHistory.shift();
    }
  }

  private recalculate() {
    if (this.samples.length < 3) return;

    const totalBytes = this.samples.reduce((acc, s) => acc + s.bytes, 0);
    const totalTime = this.samples.reduce((acc, s) => acc + s.time, 0);
    const bytesPerSecond = (totalBytes / totalTime) * 1000;

    const newChunkSize = calculateOptimalChunkSize(bytesPerSecond);
    const newParallelChunks = calculateOptimalParallelChunks(bytesPerSecond);

    // Smooth adjustments
    this.currentChunkSize = Math.round(this.currentChunkSize * 0.7 + newChunkSize * 0.3);
    this.currentParallelChunks = Math.round(this.currentParallelChunks * 0.7 + newParallelChunks * 0.3);

    // Clamp
    this.currentChunkSize = Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, this.currentChunkSize));
    this.currentParallelChunks = Math.min(MAX_PARALLEL_CHUNKS, Math.max(MIN_PARALLEL_CHUNKS, this.currentParallelChunks));
    
    // Update global cache for future uploads
    cachedSpeedProfile = {
      bytesPerSecond,
      optimalChunkSize: this.currentChunkSize,
      optimalParallelChunks: this.currentParallelChunks,
      measuredAt: Date.now(),
    };
  }

  getChunkSize(): number { return this.currentChunkSize; }
  getParallelChunks(): number { return this.currentParallelChunks; }
  getSpeedHistory(): SpeedDataPoint[] { return [...this.speedHistory]; }
  getEstimatedSpeed(): number {
    if (this.samples.length === 0) return 0;
    const totalBytes = this.samples.reduce((acc, s) => acc + s.bytes, 0);
    const totalTime = this.samples.reduce((acc, s) => acc + s.time, 0);
    return (totalBytes / totalTime) * 1000;
  }
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
 * Upload large file in chunks with resume capability and adaptive speed
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
  
  // Get initial speed profile
  const speedProfile = getSpeedProfile();
  const speedTracker = new AdaptiveSpeedTracker(speedProfile.optimalChunkSize, speedProfile.optimalParallelChunks);
  
  // Use adaptive chunk size
  let chunkSize = speedTracker.getChunkSize();
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  let uploadId = existingUploadId;
  let uploadedChunks: number[] = [];
  let storageFileName = ''; // The final filename on VPS (for direct append)

  // Initialize or resume upload
  if (!uploadId) {
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
          chunkSize, // Send chunk size to server
        }),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(error.error || "Failed to initialize upload");
    }

    const initResult = await initResponse.json();
    uploadId = initResult.uploadId;
    storageFileName = initResult.storageFileName || ''; // Get storage filename from server

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
    const statusResponse = await fetch(
      `${supabaseUrl}/functions/v1/vps-chunked-upload?action=status&uploadId=${uploadId}`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      uploadedChunks = statusResult.uploadedChunks || [];
      storageFileName = statusResult.storageFileName || '';
      console.log(`📦 Resuming upload: ${uploadedChunks.length}/${totalChunks} chunks already uploaded`);
    }
  }

  const startTime = Date.now();
  let totalUploaded = uploadedChunks.reduce((acc, idx) => {
    const chunkStart = idx * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
    return acc + (chunkEnd - chunkStart);
  }, 0);

  const remainingChunks = Array.from({ length: totalChunks }, (_, i) => i)
    .filter(i => !uploadedChunks.includes(i));

  // Upload chunks in adaptive parallel batches
  let batchStart = 0;
  while (batchStart < remainingChunks.length) {
    // Get current optimal parallel count (adapts during upload)
    const parallelCount = speedTracker.getParallelChunks();
    const batch = remainingChunks.slice(batchStart, batchStart + parallelCount);
    
    if (onProgress) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = speedTracker.getEstimatedSpeed() || (totalUploaded > 0 && elapsed > 0 ? totalUploaded / elapsed : 0);
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
        adaptiveChunkSize: speedTracker.getChunkSize(),
        adaptiveParallelChunks: speedTracker.getParallelChunks(),
        speedHistory: speedTracker.getSpeedHistory(),
        uploadedChunks: [...uploadedChunks],
      });
    }

    const batchPromises = batch.map(async (chunkIndex) => {
      const chunkStart = chunkIndex * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
      const chunk = file.slice(chunkStart, chunkEnd);
      const chunkBytes = chunkEnd - chunkStart;

      const formData = new FormData();
      formData.append("chunk", new Blob([chunk]));
      formData.append("uploadId", uploadId!);
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("storageFileName", storageFileName); // Send storage filename for direct append

      const chunkStartTime = performance.now();
      
      const chunkResponse = await fetch(
        `${supabaseUrl}/functions/v1/vps-chunked-upload?action=chunk`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}` },
          body: formData,
        }
      );

      const chunkDuration = performance.now() - chunkStartTime;
      
      // Track speed for adaptive adjustment
      speedTracker.addSample(chunkBytes, chunkDuration);
      
      // Update storageFileName from response if provided (first chunk sets it)
      if (chunkResponse.ok) {
        const chunkResult = await chunkResponse.json();
        if (chunkResult.storageFileName && !storageFileName) {
          storageFileName = chunkResult.storageFileName;
        }
        return { chunkIndex, chunkSize: chunkBytes };
      } else {
        const error = await chunkResponse.json();
        throw new Error(error.error || `Failed to upload chunk ${chunkIndex}`);
      }
    });

    // Wait for all chunks in batch to complete
    const results = await Promise.all(batchPromises);
    
    // Update tracking
    for (const result of results) {
      totalUploaded += result.chunkSize;
      uploadedChunks.push(result.chunkIndex);
    }

    // Update localStorage after each batch
    const existingState = getResumableUploads().find(u => u.uploadId === uploadId);
    if (existingState) {
      saveResumableUpload({ ...existingState, uploadedChunks });
    }
    
    batchStart += parallelCount;
  }

  // Verify all chunks are uploaded on server before finalizing
  // This handles race conditions where DB updates complete after batch promises resolve
  let verifyAttempts = 0;
  const maxVerifyAttempts = 5;
  
  while (verifyAttempts < maxVerifyAttempts) {
    const statusResponse = await fetch(
      `${supabaseUrl}/functions/v1/vps-chunked-upload?action=status&uploadId=${uploadId}`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      const serverUploadedChunks: number[] = statusResult.uploadedChunks || [];
      
      if (serverUploadedChunks.length === totalChunks) {
        console.log(`✅ All ${totalChunks} chunks verified on server`);
        break;
      }
      
      // Find missing chunks and re-upload them
      const missingChunks = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !serverUploadedChunks.includes(i));
      
      if (missingChunks.length > 0) {
        console.log(`🔄 Re-uploading ${missingChunks.length} missing chunks: ${missingChunks.slice(0, 10).join(', ')}${missingChunks.length > 10 ? '...' : ''}`);
        
        // Re-upload missing chunks
        for (const chunkIndex of missingChunks) {
          const chunkStart = chunkIndex * chunkSize;
          const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
          const chunk = file.slice(chunkStart, chunkEnd);

          const formData = new FormData();
          formData.append("chunk", new Blob([chunk]));
          formData.append("uploadId", uploadId!);
          formData.append("chunkIndex", String(chunkIndex));
          formData.append("storageFileName", storageFileName);

          const chunkResponse = await fetch(
            `${supabaseUrl}/functions/v1/vps-chunked-upload?action=chunk`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}` },
              body: formData,
            }
          );

          if (!chunkResponse.ok) {
            console.error(`Failed to re-upload chunk ${chunkIndex}`);
          } else {
            console.log(`✅ Re-uploaded chunk ${chunkIndex}`);
          }
        }
      }
    }
    
    verifyAttempts++;
    if (verifyAttempts < maxVerifyAttempts) {
      // Wait a bit before next verification
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Finalize upload with automatic retry for missing chunks
  const MAX_FINALIZE_RETRIES = 3;
  let finalizeAttempt = 0;
  
  while (finalizeAttempt < MAX_FINALIZE_RETRIES) {
    finalizeAttempt++;
    
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
        body: JSON.stringify({ uploadId, storageFileName }), // Include storageFileName
      }
    );

    if (finalizeResponse.ok) {
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
    }

    // Handle finalization error
    const errorData = await finalizeResponse.json();
    
    // Check if error contains failedChunks (missing chunks on VPS storage)
    if (errorData.failedChunks && Array.isArray(errorData.failedChunks) && errorData.failedChunks.length > 0) {
      const missingChunks: number[] = errorData.failedChunks;
      console.log(`🔄 Finalize attempt ${finalizeAttempt}/${MAX_FINALIZE_RETRIES}: Re-uploading ${missingChunks.length} missing chunks from VPS storage`);
      
      if (onProgress) {
        onProgress({
          loaded: totalUploaded,
          total: file.size,
          percentage: Math.round((totalUploaded / file.size) * 95), // Show slightly lower during retry
          speed: 0,
          remainingTime: 0,
          fileName: file.name,
          status: 'uploading',
          chunked: true,
          currentChunk: uploadedChunks.length,
          totalChunks,
          uploadId,
        });
      }
      
      // Re-upload missing chunks
      for (const chunkIndex of missingChunks) {
        const chunkStart = chunkIndex * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
        const chunk = file.slice(chunkStart, chunkEnd);

        const formData = new FormData();
        formData.append("chunk", new Blob([chunk]));
        formData.append("uploadId", uploadId!);
        formData.append("chunkIndex", String(chunkIndex));
        formData.append("storageFileName", storageFileName);

        try {
          const chunkResponse = await fetch(
            `${supabaseUrl}/functions/v1/vps-chunked-upload?action=chunk`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}` },
              body: formData,
            }
          );

          if (chunkResponse.ok) {
            console.log(`✅ Re-uploaded missing chunk ${chunkIndex}`);
          } else {
            console.error(`❌ Failed to re-upload chunk ${chunkIndex}`);
          }
        } catch (e) {
          console.error(`❌ Error re-uploading chunk ${chunkIndex}:`, e);
        }
      }
      
      // Wait a bit before retrying finalization
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue; // Retry finalization
    }
    
    // Check if error contains missingChunks (DB tracking issue - chunks not recorded)
    if (errorData.missingChunks && Array.isArray(errorData.missingChunks) && errorData.missingChunks.length > 0) {
      const missingChunks: number[] = errorData.missingChunks;
      console.log(`🔄 Finalize attempt ${finalizeAttempt}/${MAX_FINALIZE_RETRIES}: Re-uploading ${missingChunks.length} untracked chunks`);
      
      // Re-upload missing chunks (this will also record them in DB)
      for (const chunkIndex of missingChunks) {
        const chunkStart = chunkIndex * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
        const chunk = file.slice(chunkStart, chunkEnd);

        const formData = new FormData();
        formData.append("chunk", new Blob([chunk]));
        formData.append("uploadId", uploadId!);
        formData.append("chunkIndex", String(chunkIndex));
        formData.append("storageFileName", storageFileName);

        try {
          const chunkResponse = await fetch(
            `${supabaseUrl}/functions/v1/vps-chunked-upload?action=chunk`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}` },
              body: formData,
            }
          );

          if (chunkResponse.ok) {
            console.log(`✅ Re-uploaded chunk ${chunkIndex}`);
          } else {
            console.error(`❌ Failed to re-upload chunk ${chunkIndex}`);
          }
        } catch (e) {
          console.error(`❌ Error re-uploading chunk ${chunkIndex}:`, e);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue; // Retry finalization
    }
    
    // No recoverable error, throw
    throw new Error(errorData.error || "Failed to finalize upload");
  }
  
  // All retries exhausted
  throw new Error(`Failed to finalize upload after ${MAX_FINALIZE_RETRIES} attempts`);
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

/**
 * Update bandwidth usage in usage_metrics table after upload
 */
export const updateBandwidthUsage = async (userId: string, bytesTransferred: number): Promise<void> => {
  try {
    // Get current period start/end
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    // Check if usage metrics record exists for this period
    const { data: existing } = await supabase
      .from("usage_metrics")
      .select("id, bandwidth_used_bytes, storage_used_bytes")
      .eq("user_id", userId)
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd)
      .single();
    
    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from("usage_metrics")
        .update({
          bandwidth_used_bytes: Number(existing.bandwidth_used_bytes) + bytesTransferred,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      
      if (error) {
        console.error("Failed to update bandwidth usage:", error);
      } else {
        console.log(`📊 Updated bandwidth usage: +${formatFileSize(bytesTransferred)}`);
      }
    } else {
      // Create new record for this period
      const { error } = await supabase
        .from("usage_metrics")
        .insert({
          user_id: userId,
          bandwidth_used_bytes: bytesTransferred,
          storage_used_bytes: 0,
          period_start: periodStart,
          period_end: periodEnd,
        });
      
      if (error) {
        console.error("Failed to create bandwidth usage record:", error);
      } else {
        console.log(`📊 Created bandwidth usage record: ${formatFileSize(bytesTransferred)}`);
      }
    }
  } catch (e) {
    console.error("Error updating bandwidth usage:", e);
  }
};

/**
 * Update storage usage in usage_metrics table
 */
export const updateStorageUsage = async (userId: string, bytesChange: number): Promise<void> => {
  try {
    // Get current period start/end
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    
    // Check if usage metrics record exists for this period
    const { data: existing } = await supabase
      .from("usage_metrics")
      .select("id, storage_used_bytes")
      .eq("user_id", userId)
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd)
      .single();
    
    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from("usage_metrics")
        .update({
          storage_used_bytes: Math.max(0, Number(existing.storage_used_bytes) + bytesChange),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      
      if (error) {
        console.error("Failed to update storage usage:", error);
      }
    } else {
      // Create new record for this period
      const { error } = await supabase
        .from("usage_metrics")
        .insert({
          user_id: userId,
          storage_used_bytes: Math.max(0, bytesChange),
          bandwidth_used_bytes: 0,
          period_start: periodStart,
          period_end: periodEnd,
        });
      
      if (error) {
        console.error("Failed to create storage usage record:", error);
      }
    }
  } catch (e) {
    console.error("Error updating storage usage:", e);
  }
};

/**
 * Upload multiple files with parallel processing for faster batch uploads
 */
export const uploadMultipleFiles = async (
  files: File[],
  userId: string,
  folderId: string | null,
  onProgress?: (fileIndex: number, progress: UploadProgress | number) => void
): Promise<FileItem[]> => {
  const results: FileItem[] = new Array(files.length);
  const fileQueue = files.map((file, index) => ({ file, index }));
  let currentIndex = 0;

  // Process files in parallel batches
  const uploadWorker = async (): Promise<void> => {
    while (currentIndex < fileQueue.length) {
      const { file, index } = fileQueue[currentIndex++];
      try {
        const result = await uploadFile(file, userId, folderId, (progress) => {
          if (onProgress) onProgress(index, progress);
        });
        results[index] = result;
      } catch (error) {
        console.error(`Failed to upload file ${index}:`, error);
        throw error;
      }
    }
  };

  // Start parallel workers
  const workers = Array.from(
    { length: Math.min(PARALLEL_FILES, files.length) },
    () => uploadWorker()
  );

  await Promise.all(workers);

  return results.filter(Boolean);
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
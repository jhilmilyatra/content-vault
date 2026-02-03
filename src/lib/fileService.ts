import { supabase } from "@/integrations/supabase/client";
import { getCachedUrl, setCachedUrl, clearUrlCache } from "@/lib/urlCache";
import { warmVideoStreamUrl, isVideoFile } from "@/lib/videoStreamCache";
import { extractVideoMetadata, updateVideoMetadata, isVideo } from "@/lib/videoMetadata";
import { extractImageMetadata, isImage } from "@/lib/imageMetadata";
import { startThumbnailProcessing, finishThumbnailProcessing } from "@/lib/thumbnailProcessing";
import { toast } from "@/hooks/use-toast";

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
  duration_seconds: number | null;
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

// Finalization progress for file assembly
export interface FinalizationProgress {
  phase: 'verifying' | 'assembling' | 'creating-record' | 'complete';
  progress: number; // 0-100
  message: string;
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
  // Finalization progress
  finalizationProgress?: FinalizationProgress;
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

// VPS configuration - direct connection for maximum upload speed
// Uploads go directly to VPS, bypassing edge function middleman
const PRIMARY_VPS_CONFIG = {
  endpoint: "https://cloudvaults.in/api",
  apiKey: "kARTOOS@007",
};

const STORAGE_NODES_KEY = "vps_storage_nodes";

/**
 * Get direct VPS file URL (no auth needed - files endpoint is public)
 * NOTE: Only works when accessed from same origin or with proper CORS
 * For cross-origin HTTPS access, use the edge function proxy instead
 */
export const getDirectVPSUrl = (storagePath: string): string => {
  return `${PRIMARY_VPS_CONFIG.endpoint}/files/${storagePath}`;
};

/**
 * Get direct VPS HLS URL for video streaming
 * NOTE: Only works when accessed from same origin or with proper CORS
 */
export const getDirectHLSUrl = (storagePath: string): string => {
  const pathParts = storagePath.split('/');
  const fileName = pathParts.pop() || '';
  const userId = pathParts[0];
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `${PRIMARY_VPS_CONFIG.endpoint}/hls/${userId}/${baseName}/master.m3u8`;
};

/**
 * Check if VPS is reachable (quick health check)
 */
export const checkVPSHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${PRIMARY_VPS_CONFIG.endpoint}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get VPS API key for authenticated requests
 */
export const getVPSApiKey = (): string => PRIMARY_VPS_CONFIG.apiKey;

/**
 * Get VPS endpoint
 */
export const getVPSEndpoint = (): string => PRIMARY_VPS_CONFIG.endpoint;

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
 * Extract video metadata and upload thumbnail after video upload
 * Runs in background - does not block upload completion
 */
async function extractAndUploadVideoMetadata(
  file: File,
  fileId: string,
  authToken: string
): Promise<void> {
  const fileName = file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name;
  
  // Mark file as processing
  startThumbnailProcessing(fileId);
  
  try {
    console.log('🎬 Extracting video metadata for:', file.name);
    
    // Show toast notification for thumbnail extraction start
    toast({
      title: "Generating thumbnail",
      description: `Processing ${fileName}...`,
    });
    
    // Extract metadata and generate thumbnail
    const metadata = await extractVideoMetadata(file, {
      thumbnailTime: 2, // Capture at 2 seconds
      thumbnailWidth: 480,
      thumbnailQuality: 0.8,
    });

    console.log(`📊 Video metadata: ${metadata.width}x${metadata.height}, ${Math.round(metadata.duration)}s`);

    // Update file record with metadata
    await updateVideoMetadata(
      fileId,
      {
        thumbnailUrl: metadata.thumbnailDataUrl, // Send data URL, backend will upload to VPS
        duration: metadata.duration,
      },
      authToken
    );

    console.log('✅ Video metadata updated successfully');
    
    // Show success toast
    toast({
      title: "Thumbnail ready",
      description: `${fileName} thumbnail generated`,
    });
  } catch (error) {
    console.warn('Failed to extract video metadata:', error);
    
    // Show error toast (non-blocking)
    toast({
      title: "Thumbnail failed",
      description: `Could not generate thumbnail for ${fileName}`,
      variant: "destructive",
    });
    // Non-critical - don't throw
  } finally {
    // Mark file as finished processing
    finishThumbnailProcessing(fileId);
  }
}

/**
 * Extract image metadata and upload thumbnail after image upload
 * Runs in background - does not block upload completion
 */
async function extractAndUploadImageMetadata(
  file: File,
  fileId: string,
  authToken: string
): Promise<void> {
  const fileName = file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name;
  
  // Mark file as processing
  startThumbnailProcessing(fileId);
  
  try {
    console.log('🖼️ Extracting image metadata for:', file.name);
    
    // Extract metadata and generate thumbnail
    const metadata = await extractImageMetadata(file, {
      thumbnailWidth: 480,
      thumbnailQuality: 0.8,
    });

    // Skip if no thumbnail was generated (image smaller than thumbnail size)
    if (!metadata.thumbnailDataUrl) {
      console.log('ℹ️ Image already small, skipping thumbnail generation');
      return;
    }

    console.log(`📊 Image metadata: ${metadata.width}x${metadata.height}`);

    // Update file record with thumbnail (using video metadata endpoint)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/update-video-metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
        thumbnailDataUrl: metadata.thumbnailDataUrl,
        mediaType: 'image',
      }),
    });

    if (response.ok) {
      console.log('✅ Image thumbnail uploaded successfully');
    } else {
      console.warn('Failed to upload image thumbnail:', response.status);
    }
  } catch (error) {
    console.warn('Failed to extract image metadata:', error);
    // Non-critical - don't throw
  } finally {
    // Mark file as finished processing
    finishThumbnailProcessing(fileId);
  }
}

/**
 * Upload file with real progress tracking - DIRECT TO VPS for maximum speed
 * Bypasses edge function middleman, uploads directly to VPS storage server
 */
const uploadToVPSWithProgress = (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress) => void
): Promise<FileItem> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get auth session for DB record creation
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        reject(new Error("Not authenticated"));
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

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
      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const vpsResult = JSON.parse(xhr.responseText);
            console.log('📦 VPS upload complete:', vpsResult.path);
            
            // Update progress to processing (creating DB record)
            if (onProgress) {
              onProgress({
                loaded: file.size,
                total: file.size,
                percentage: 100,
                speed: 0,
                remainingTime: 0,
                fileName: file.name,
                status: 'processing'
              });
            }
            
            // Create file record in database
            const { data: fileRecord, error: dbError } = await supabase
              .from("files")
              .insert({
                user_id: userId,
                folder_id: folderId,
                name: vpsResult.fileName,
                original_name: file.name,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                storage_path: vpsResult.path,
              })
              .select()
              .single();

            if (dbError) {
              console.error("Database error:", dbError);
              reject(new Error(`Failed to create file record: ${dbError.message}`));
              return;
            }
            
            const uploadedFile = fileRecord as FileItem;
            
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
            
            // For video files: extract metadata, generate thumbnail, and warm stream
            if (isVideoFile(uploadedFile.mime_type, uploadedFile.original_name)) {
              // Extract metadata and thumbnail in background
              extractAndUploadVideoMetadata(file, uploadedFile.id, sessionData.session!.access_token)
                .catch((err) => console.warn('Video metadata extraction failed:', err));
              
              // Warm stream URL and CDN edge cache for instant playback
              warmVideoStreamUrl(uploadedFile.id, uploadedFile.storage_path, { 
                priority: 'high', 
                showToast: true,
                warmEdge: true 
              })
                .then(() => console.log('📹 Video stream pre-warmed after upload'))
                .catch(() => {}); // Silent fail - not critical
            }
            
            // For image files: extract thumbnail in background
            if (isImage(uploadedFile.mime_type, uploadedFile.original_name)) {
              extractAndUploadImageMetadata(file, uploadedFile.id, sessionData.session!.access_token)
                .catch((err) => console.warn('Image metadata extraction failed:', err));
            }
            
            resolve(uploadedFile);
          } catch (e) {
            console.error('Parse error:', e);
            reject(new Error("Failed to parse VPS response"));
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

      // DIRECT VPS UPLOAD - bypasses edge function for maximum speed
      xhr.open("POST", `${PRIMARY_VPS_CONFIG.endpoint}/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${PRIMARY_VPS_CONFIG.apiKey}`);
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
 * Upload large file in chunks - DIRECT TO VPS with PARALLEL uploads for maximum speed
 * Uses parallel chunk uploads to separate temp files, then server-side assembly
 */
const uploadChunked = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: UploadProgress) => void,
  _existingUploadId?: string
): Promise<FileItem> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error("Not authenticated");
  }

  // Generate unique upload ID and filename for VPS storage
  const uploadId = crypto.randomUUID();
  const ext = file.name.split('.').pop() || '';
  const storageFileName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${userId}/${storageFileName}`;
  
  // Use 10MB chunks for faster uploads (larger chunks = fewer round trips)
  const chunkSize = 10 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // Parallel uploads - use 4 concurrent connections for maximum throughput
  const PARALLEL_UPLOADS = 4;
  
  const startTime = Date.now();
  let completedChunks = 0;
  let totalBytesUploaded = 0;
  const uploadedChunkIndices: number[] = [];
  
  console.log(`📦 Starting parallel VPS chunked upload: ${file.name} (${totalChunks} chunks, ${PARALLEL_UPLOADS} parallel)`);
  
  // Initial progress
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
      uploadedChunks: [],
    });
  }

  // Upload a single chunk to temp storage
  const uploadChunkToTemp = async (chunkIndex: number): Promise<void> => {
    const chunkStart = chunkIndex * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, file.size);
    const chunk = file.slice(chunkStart, chunkEnd);
    const chunkBytes = chunkEnd - chunkStart;
    
    const formData = new FormData();
    formData.append('chunk', chunk, `chunk_${chunkIndex}`);
    formData.append('uploadId', uploadId);
    formData.append('fileName', storageFileName);
    formData.append('userId', userId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    
    const chunkStartTime = performance.now();
    
    // Upload to temp chunk storage (parallel-safe endpoint)
    const response = await fetch(`${PRIMARY_VPS_CONFIG.endpoint}/chunk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRIMARY_VPS_CONFIG.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to upload chunk ${chunkIndex}`);
    }
    
    const chunkDuration = performance.now() - chunkStartTime;
    completedChunks++;
    totalBytesUploaded += chunkBytes;
    uploadedChunkIndices.push(chunkIndex);
    
    // Calculate speed and remaining time
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = totalBytesUploaded / elapsed;
    const remaining = file.size - totalBytesUploaded;
    const remainingTime = speed > 0 ? remaining / speed : 0;
    
    if (onProgress) {
      onProgress({
        loaded: totalBytesUploaded,
        total: file.size,
        percentage: Math.round((totalBytesUploaded / file.size) * 100),
        speed,
        remainingTime,
        fileName: file.name,
        status: 'uploading',
        chunked: true,
        currentChunk: completedChunks,
        totalChunks,
        uploadedChunks: [...uploadedChunkIndices].sort((a, b) => a - b),
      });
    }
    
    console.log(`📦 Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${Math.round(chunkDuration)}ms, ${formatFileSize(speed)}/s)`);
  };
  
  // Create chunk upload queue
  const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
  let queueIndex = 0;
  
  // Worker function that processes chunks from the queue
  const worker = async (): Promise<void> => {
    while (queueIndex < chunkIndices.length) {
      const chunkIndex = chunkIndices[queueIndex++];
      await uploadChunkToTemp(chunkIndex);
    }
  };
  
  // Start parallel workers
  const workers = Array.from(
    { length: Math.min(PARALLEL_UPLOADS, totalChunks) },
    () => worker()
  );
  
  // Wait for all chunks to complete
  await Promise.all(workers);
  
  // Update progress to finalization phase
  if (onProgress) {
    onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'processing',
      chunked: true,
      currentChunk: totalChunks,
      totalChunks,
      uploadedChunks: uploadedChunkIndices.sort((a, b) => a - b),
      finalizationProgress: {
        phase: 'assembling',
        progress: 10,
        message: 'Assembling file on server...',
      },
    });
  }
  
  // Tell server to assemble all chunks into final file
  console.log(`🔧 Finalizing upload: assembling ${totalChunks} chunks...`);
  const finalizeResponse = await fetch(`${PRIMARY_VPS_CONFIG.endpoint}/finalize-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRIMARY_VPS_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadId,
      fileName: storageFileName,
      userId,
      totalChunks,
      mimeType: file.type || 'application/octet-stream',
    }),
  });

  if (!finalizeResponse.ok) {
    const errorData = await finalizeResponse.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to finalize upload');
  }
  
  const finalizeResult = await finalizeResponse.json();
  console.log(`✅ File assembled on VPS: ${finalizeResult.path}`);
  
  // Update progress to finalization complete
  if (onProgress) {
    onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'processing',
      chunked: true,
      currentChunk: totalChunks,
      totalChunks,
      finalizationProgress: {
        phase: 'creating-record',
        progress: 80,
        message: 'Creating database record...',
      },
    });
  }

  // Update progress to processing (creating DB record)
  if (onProgress) {
    onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speed: 0,
      remainingTime: 0,
      fileName: file.name,
      status: 'processing',
      chunked: true,
      currentChunk: totalChunks,
      totalChunks,
    });
  }

  // Create file record in database
  const { data: fileRecord, error: dbError } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      folder_id: folderId,
      name: storageFileName,
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (dbError) {
    console.error("Database error:", dbError);
    throw new Error(`Failed to create file record: ${dbError.message}`);
  }

  const uploadedFile = fileRecord as FileItem;
  
  // Final progress
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
    });
  }

  console.log(`✅ Chunked upload complete: ${storagePath}`);

  // For video files: extract metadata and warm stream in background
  if (isVideoFile(uploadedFile.mime_type, uploadedFile.original_name)) {
    extractAndUploadVideoMetadata(file, uploadedFile.id, sessionData.session.access_token)
      .catch((err) => console.warn('Video metadata extraction failed:', err));
    
    warmVideoStreamUrl(uploadedFile.id, uploadedFile.storage_path, { 
      priority: 'high', 
      showToast: true,
      warmEdge: true 
    })
      .then(() => console.log('📹 Video stream pre-warmed after upload'))
      .catch(() => {});
  }
  
  // For image files: extract thumbnail in background
  if (isImage(uploadedFile.mime_type, uploadedFile.original_name)) {
    extractAndUploadImageMetadata(file, uploadedFile.id, sessionData.session.access_token)
      .catch((err) => console.warn('Image metadata extraction failed:', err));
  }

  return uploadedFile;
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
  // Clear URL cache for this file
  clearUrlCache(storagePath);
  
  // Soft delete in database
  const { error: dbError } = await supabase
    .from("files")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", fileId);

  if (dbError) throw dbError;
};

export const permanentDeleteFile = async (fileId: string, storagePath: string): Promise<void> => {
  // Clear URL cache for this file
  clearUrlCache(storagePath);
  
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
  // Check cache first
  const cachedUrl = getCachedUrl(storagePath, 'url');
  if (cachedUrl) {
    console.log('📦 URL cache hit:', storagePath);
    return cachedUrl;
  }

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
  
  // Build the final URL
  let finalUrl: string;
  if (result.storage === "vps") {
    finalUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(storagePath)}&action=get`;
  } else {
    finalUrl = result.url;
  }
  
  // Cache the URL (50 min TTL)
  setCachedUrl(storagePath, finalUrl, 'url');
  console.log('📥 URL cached:', storagePath);
  
  return finalUrl;
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

export const moveFile = async (fileId: string, newFolderId: string | null, storagePath?: string): Promise<void> => {
  // Clear URL cache if storage path provided (file location conceptually changed)
  if (storagePath) {
    clearUrlCache(storagePath);
  }
  
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
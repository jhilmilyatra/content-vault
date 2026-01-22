/**
 * Video Metadata Extraction - Client-side duration and thumbnail generation
 * 
 * Extracts video metadata before/during upload for instant preview and database storage.
 * Uses HTML5 video element for cross-browser compatibility.
 */

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  thumbnailBlob: Blob | null;
  thumbnailDataUrl: string | null;
}

/**
 * Extract metadata and generate thumbnail from a video file
 * Returns duration, dimensions, and a thumbnail image
 */
export function extractVideoMetadata(
  file: File,
  options?: {
    thumbnailTime?: number; // Time in seconds to capture thumbnail (default: 2s or 10%)
    thumbnailWidth?: number; // Max thumbnail width (default: 480)
    thumbnailQuality?: number; // JPEG quality 0-1 (default: 0.8)
  }
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const { 
      thumbnailTime, 
      thumbnailWidth = 480, 
      thumbnailQuality = 0.8 
    } = options || {};

    // Create object URL for the video file
    const videoUrl = URL.createObjectURL(file);
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(videoUrl);
      video.src = '';
      video.load();
    };

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video metadata extraction timed out'));
    }, 30000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // Handle metadata loaded
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!duration || !isFinite(duration)) {
        clearTimeout(timeout);
        cleanup();
        resolve({
          duration: 0,
          width: width || 0,
          height: height || 0,
          thumbnailBlob: null,
          thumbnailDataUrl: null,
        });
        return;
      }

      // Calculate thumbnail capture time (default: 2s or 10% of duration, whichever is less)
      const captureTime = thumbnailTime ?? Math.min(2, duration * 0.1);
      
      // Seek to capture time
      video.currentTime = Math.min(captureTime, duration - 0.1);
    };

    // Handle seek complete - capture frame
    video.onseeked = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;

      // Calculate scaled dimensions (maintain aspect ratio)
      const scale = thumbnailWidth / width;
      const scaledWidth = thumbnailWidth;
      const scaledHeight = Math.round(height * scale);

      // Set canvas size and draw frame
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.drawImage(video, 0, 0, scaledWidth, scaledHeight);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          clearTimeout(timeout);
          const dataUrl = canvas.toDataURL('image/jpeg', thumbnailQuality);
          cleanup();

          resolve({
            duration,
            width,
            height,
            thumbnailBlob: blob,
            thumbnailDataUrl: dataUrl,
          });
        },
        'image/jpeg',
        thumbnailQuality
      );
    };

    // Handle errors
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      // Return partial data on error (no thumbnail)
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        thumbnailBlob: null,
        thumbnailDataUrl: null,
      });
    };

    // Start loading
    video.src = videoUrl;
    video.load();
  });
}

/**
 * Upload thumbnail to VPS storage and return the URL
 */
export async function uploadThumbnail(
  thumbnailBlob: Blob,
  storagePath: string,
  authToken: string
): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Create a thumbnail filename based on the video storage path
    const baseName = storagePath.replace(/\.[^.]+$/, '');
    const thumbnailPath = `${baseName}_thumb.jpg`;

    // Convert blob to base64
    const arrayBuffer = await thumbnailBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = uint8ArrayToBase64(bytes);

    const response = await fetch(`${supabaseUrl}/functions/v1/vps-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: thumbnailPath.split('/').pop(),
        fileData: base64,
        mimeType: 'image/jpeg',
        userId: storagePath.split('/')[0],
      }),
    });

    if (!response.ok) {
      console.error('Failed to upload thumbnail:', response.status);
      return null;
    }

    const result = await response.json();
    return result.file?.storage_path || null;
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    return null;
  }
}

/**
 * Update file record with video metadata (duration, thumbnail)
 */
export async function updateVideoMetadata(
  fileId: string,
  metadata: {
    thumbnailUrl?: string | null;
    duration?: number;
  },
  authToken: string
): Promise<boolean> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const response = await fetch(`${supabaseUrl}/functions/v1/update-video-metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
        thumbnailUrl: metadata.thumbnailUrl,
        durationSeconds: metadata.duration,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to update video metadata:', error);
    return false;
  }
}

// Helper to convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Check if file is a video
 */
export function isVideo(mimeType: string, fileName?: string): boolean {
  if (mimeType.startsWith('video/')) return true;
  if (fileName) {
    return /\.(mp4|mkv|webm|mov|avi|m4v|wmv|flv)$/i.test(fileName);
  }
  return false;
}

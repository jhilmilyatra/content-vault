/**
 * HLS Utilities
 * 
 * Helper functions for detecting and handling HLS video streams
 */

/**
 * Check if a URL points to an HLS stream
 */
export function isHLSUrl(url: string): boolean {
  if (!url) return false;
  const lowercaseUrl = url.toLowerCase();
  return lowercaseUrl.includes('.m3u8') || 
         lowercaseUrl.includes('application/vnd.apple.mpegurl');
}

/**
 * Check if browser natively supports HLS (Safari)
 */
export function supportsNativeHLS(): boolean {
  const video = document.createElement('video');
  return !!video.canPlayType('application/vnd.apple.mpegurl');
}

/**
 * Generate HLS playlist URL from VPS video path
 * Returns null if the video hasn't been transcoded to HLS yet
 */
export function getHLSUrl(vpsEndpoint: string, storagePath: string): string {
  // Convert video path to HLS path
  // e.g., userId/video.mp4 -> userId/hls/video/index.m3u8
  const pathParts = storagePath.split('/');
  const fileName = pathParts.pop() || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const userId = pathParts[0];
  
  return `${vpsEndpoint}/hls/${userId}/${baseName}/index.m3u8`;
}

/**
 * Check if HLS version exists for a video
 */
export async function hasHLSVersion(
  vpsEndpoint: string, 
  storagePath: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const hlsUrl = getHLSUrl(vpsEndpoint, storagePath);
    const response = await fetch(hlsUrl, {
      method: 'HEAD',
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Video format info
 */
export interface VideoFormatInfo {
  isVideo: boolean;
  supportsHLS: boolean;
  mimeType: string;
  extension: string;
}

/**
 * Get video format information from file name or mime type
 */
export function getVideoFormatInfo(fileName: string, mimeType?: string): VideoFormatInfo {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const type = mimeType?.toLowerCase() || '';
  
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv', 'wmv'];
  const hlsCompatible = ['mp4', 'mov', 'm4v', 'webm']; // Formats that can be transcoded to HLS
  
  const isVideo = videoExtensions.includes(ext) || type.startsWith('video/');
  const supportsHLS = hlsCompatible.includes(ext);
  
  return {
    isVideo,
    supportsHLS,
    mimeType: type || `video/${ext}`,
    extension: ext
  };
}

/**
 * Recommended HLS.js configuration for optimal playback
 */
export const HLS_CONFIG = {
  // Performance tuning
  lowLatencyMode: true,
  backBufferLength: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  
  // Fast startup
  startLevel: -1, // Auto
  capLevelToPlayerSize: true,
  
  // Retry configuration
  manifestLoadingMaxRetry: 4,
  levelLoadingMaxRetry: 4,
  fragLoadingMaxRetry: 6,
  manifestLoadingRetryDelay: 500,
  levelLoadingRetryDelay: 500,
  fragLoadingRetryDelay: 500,
};

/**
 * Calculate optimal segment duration based on video duration
 */
export function getOptimalSegmentDuration(videoDurationSeconds: number): number {
  if (videoDurationSeconds < 30) return 2;
  if (videoDurationSeconds < 120) return 4;
  if (videoDurationSeconds < 600) return 6;
  return 10;
}

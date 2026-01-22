/**
 * Image Metadata Extraction - Client-side thumbnail generation for images
 * 
 * Generates resized thumbnails for faster loading and consistent display.
 * Uses HTML5 canvas for cross-browser compatibility.
 */

export interface ImageMetadata {
  width: number;
  height: number;
  thumbnailBlob: Blob | null;
  thumbnailDataUrl: string | null;
}

/**
 * Extract metadata and generate thumbnail from an image file
 */
export function extractImageMetadata(
  file: File,
  options?: {
    thumbnailWidth?: number; // Max thumbnail width (default: 480)
    thumbnailQuality?: number; // JPEG quality 0-1 (default: 0.8)
  }
): Promise<ImageMetadata> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    const { 
      thumbnailWidth = 480, 
      thumbnailQuality = 0.8 
    } = options || {};

    // Create object URL for the image file
    const imageUrl = URL.createObjectURL(file);
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(imageUrl);
    };

    // Timeout after 15 seconds
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Image metadata extraction timed out'));
    }, 15000);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      // Skip if image is already smaller than thumbnail size
      if (width <= thumbnailWidth) {
        clearTimeout(timeout);
        cleanup();
        resolve({
          width,
          height,
          thumbnailBlob: null,
          thumbnailDataUrl: null,
        });
        return;
      }

      // Calculate scaled dimensions (maintain aspect ratio)
      const scale = thumbnailWidth / width;
      const scaledWidth = thumbnailWidth;
      const scaledHeight = Math.round(height * scale);

      // Set canvas size and draw image
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          clearTimeout(timeout);
          const dataUrl = canvas.toDataURL('image/jpeg', thumbnailQuality);
          cleanup();

          resolve({
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

    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({
        width: 0,
        height: 0,
        thumbnailBlob: null,
        thumbnailDataUrl: null,
      });
    };

    // Start loading
    img.src = imageUrl;
  });
}

/**
 * Check if file is an image
 */
export function isImage(mimeType: string, fileName?: string): boolean {
  if (mimeType.startsWith('image/')) return true;
  if (fileName) {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)$/i.test(fileName);
  }
  return false;
}

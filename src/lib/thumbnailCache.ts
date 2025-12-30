/**
 * IndexedDB-based thumbnail cache for offline access and faster loading
 */

const DB_NAME = 'ThumbnailCache';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB
const MAX_AGE_DAYS = 7; // Maximum age of cached thumbnails

interface CachedThumbnail {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('ThumbnailCache: Failed to open database', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a cache key from URL
 */
function getCacheKey(url: string): string {
  // Normalize URL by removing auth tokens and temporary params
  try {
    const urlObj = new URL(url);
    // Remove common temporary/auth query params
    urlObj.searchParams.delete('token');
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('expires');
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Get a cached thumbnail
 */
export async function getCachedThumbnail(url: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    const cacheKey = getCacheKey(url);
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onerror = () => {
        resolve(null);
      };

      request.onsuccess = () => {
        const cached = request.result as CachedThumbnail | undefined;
        
        if (!cached) {
          resolve(null);
          return;
        }

        // Check if cache is expired
        const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - cached.timestamp > maxAge) {
          // Delete expired entry
          deleteCachedThumbnail(cacheKey);
          resolve(null);
          return;
        }

        // Create blob URL
        const blobUrl = URL.createObjectURL(cached.blob);
        resolve(blobUrl);
      };
    });
  } catch (error) {
    console.warn('ThumbnailCache: Error getting cached thumbnail', error);
    return null;
  }
}

/**
 * Cache a thumbnail
 */
export async function cacheThumbnail(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    const cacheKey = getCacheKey(url);

    const cached: CachedThumbnail = {
      url: cacheKey,
      blob,
      timestamp: Date.now(),
      size: blob.size,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cached);

      request.onerror = () => {
        console.warn('ThumbnailCache: Error caching thumbnail', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        // Check cache size and cleanup if needed
        checkAndCleanupCache();
        resolve();
      };
    });
  } catch (error) {
    console.warn('ThumbnailCache: Error caching thumbnail', error);
  }
}

/**
 * Delete a cached thumbnail
 */
async function deleteCachedThumbnail(cacheKey: string): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(cacheKey);
      resolve();
    });
  } catch (error) {
    console.warn('ThumbnailCache: Error deleting cached thumbnail', error);
  }
}

/**
 * Fetch and cache a thumbnail
 */
export async function fetchAndCacheThumbnail(
  url: string,
  options?: RequestInit
): Promise<string | null> {
  try {
    // First check if we have it cached
    const cached = await getCachedThumbnail(url);
    if (cached) {
      return cached;
    }

    // Fetch the image
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    
    // Only cache images under 5MB
    if (blob.size > 5 * 1024 * 1024) {
      return URL.createObjectURL(blob);
    }

    // Cache for future use
    await cacheThumbnail(url, blob);
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('ThumbnailCache: Error fetching thumbnail', error);
    return null;
  }
}

/**
 * Check cache size and cleanup old entries if needed
 */
async function checkAndCleanupCache(): Promise<void> {
  try {
    const db = await openDatabase();
    
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = async () => {
      const entries = request.result as CachedThumbnail[];
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

      if (totalSize > maxSizeBytes) {
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a.timestamp - b.timestamp);
        
        let currentSize = totalSize;
        const entriesToDelete: string[] = [];
        
        // Delete oldest entries until we're under the limit
        for (const entry of entries) {
          if (currentSize <= maxSizeBytes * 0.8) break; // Keep 20% buffer
          entriesToDelete.push(entry.url);
          currentSize -= entry.size;
        }

        // Delete entries
        for (const url of entriesToDelete) {
          await deleteCachedThumbnail(url);
        }
      }
    };
  } catch (error) {
    console.warn('ThumbnailCache: Error during cleanup', error);
  }
}

/**
 * Clear the entire thumbnail cache
 */
export async function clearThumbnailCache(): Promise<void> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      resolve();
    });
  } catch (error) {
    console.warn('ThumbnailCache: Error clearing cache', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; totalSizeMB: number }> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CachedThumbnail[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        resolve({
          count: entries.length,
          totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        });
      };

      request.onerror = () => {
        resolve({ count: 0, totalSizeMB: 0 });
      };
    });
  } catch (error) {
    return { count: 0, totalSizeMB: 0 };
  }
}

/**
 * Preload thumbnails in the background
 */
export function preloadThumbnails(urls: string[]): void {
  // Use requestIdleCallback for background preloading
  const preload = () => {
    urls.forEach((url) => {
      fetchAndCacheThumbnail(url).catch(() => {
        // Silently ignore preload errors
      });
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload, { timeout: 5000 });
  } else {
    setTimeout(preload, 100);
  }
}

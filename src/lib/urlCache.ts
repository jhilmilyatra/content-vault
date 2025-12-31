// URL cache using sessionStorage for file URLs to reduce edge function calls

interface CachedUrl {
  url: string;
  expiresAt: number;
  storagePath: string;
}

const URL_CACHE_KEY = 'cloudvault-url-cache';
const URL_CACHE_TTL = 50 * 60 * 1000; // 50 minutes (signed URLs typically valid for 1 hour)

// In-memory cache for fastest access
const memoryUrlCache = new Map<string, CachedUrl>();

function getCacheKey(storagePath: string, action: string): string {
  return `${action}:${storagePath}`;
}

function loadFromSession(): void {
  try {
    const cached = sessionStorage.getItem(URL_CACHE_KEY);
    if (cached) {
      const entries: [string, CachedUrl][] = JSON.parse(cached);
      const now = Date.now();
      entries.forEach(([key, value]) => {
        if (value.expiresAt > now) {
          memoryUrlCache.set(key, value);
        }
      });
    }
  } catch {
    // Ignore parse errors
  }
}

function saveToSession(): void {
  try {
    const now = Date.now();
    const validEntries: [string, CachedUrl][] = [];
    memoryUrlCache.forEach((value, key) => {
      if (value.expiresAt > now) {
        validEntries.push([key, value]);
      }
    });
    sessionStorage.setItem(URL_CACHE_KEY, JSON.stringify(validEntries));
  } catch {
    // Session storage full, clear old items
    sessionStorage.removeItem(URL_CACHE_KEY);
  }
}

// Initialize from session storage
loadFromSession();

export function getCachedUrl(storagePath: string, action: string = 'url'): string | null {
  const key = getCacheKey(storagePath, action);
  const cached = memoryUrlCache.get(key);
  
  if (!cached) return null;
  
  // Check if expired (with 2 minute buffer)
  if (Date.now() > cached.expiresAt - 2 * 60 * 1000) {
    memoryUrlCache.delete(key);
    return null;
  }
  
  return cached.url;
}

export function setCachedUrl(storagePath: string, url: string, action: string = 'url', ttlMs: number = URL_CACHE_TTL): void {
  const key = getCacheKey(storagePath, action);
  
  memoryUrlCache.set(key, {
    url,
    storagePath,
    expiresAt: Date.now() + ttlMs,
  });
  
  // Persist to session storage
  saveToSession();
}

export function clearUrlCache(storagePath?: string): void {
  if (storagePath) {
    // Clear specific path
    const keysToDelete: string[] = [];
    memoryUrlCache.forEach((_, key) => {
      if (key.includes(storagePath)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => memoryUrlCache.delete(key));
  } else {
    memoryUrlCache.clear();
  }
  saveToSession();
}

export function getUrlCacheStats(): { size: number; validCount: number } {
  const now = Date.now();
  let validCount = 0;
  memoryUrlCache.forEach(value => {
    if (value.expiresAt > now) validCount++;
  });
  return { size: memoryUrlCache.size, validCount };
}

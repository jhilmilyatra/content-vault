// Cache utilities for optimized data fetching

// In-memory cache for frequently accessed data
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const MEMORY_CACHE_TTL = 60 * 1000; // 1 minute

export function getFromMemoryCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > MEMORY_CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

export function setMemoryCache(key: string, data: unknown): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function clearMemoryCache(keyPattern?: string): void {
  if (!keyPattern) {
    memoryCache.clear();
    return;
  }
  
  for (const key of memoryCache.keys()) {
    if (key.includes(keyPattern)) {
      memoryCache.delete(key);
    }
  }
}

// Session storage cache for persisted data
export function getFromSessionCache<T>(key: string): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp, ttl } = JSON.parse(cached);
    if (Date.now() - timestamp > ttl) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return data as T;
  } catch {
    return null;
  }
}

export function setSessionCache(key: string, data: unknown, ttlMs = 5 * 60 * 1000): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    }));
  } catch {
    // Session storage full, clear old items
    sessionStorage.clear();
  }
}

// Preload critical resources
export function preloadCriticalResources(): void {
  // Preload fonts
  const fontLinks = [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
  ];
  
  fontLinks.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  });
}

// Prefetch routes for faster navigation
export function prefetchRoute(path: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  document.head.appendChild(link);
}

// Image preloading with priority
export function preloadImage(src: string, priority: 'high' | 'low' = 'low'): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (priority === 'high') {
      (img as any).fetchPriority = 'high';
    }
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Debounced cache invalidation
let invalidationTimeout: ReturnType<typeof setTimeout> | null = null;
export function debouncedCacheInvalidation(keys: string[], delay = 1000): void {
  if (invalidationTimeout) {
    clearTimeout(invalidationTimeout);
  }
  
  invalidationTimeout = setTimeout(() => {
    keys.forEach(key => clearMemoryCache(key));
    invalidationTimeout = null;
  }, delay);
}

// Register service worker
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Every hour
      
      console.log('SW registered:', registration.scope);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  }
}

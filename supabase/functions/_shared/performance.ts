// Performance utilities for Edge Functions
// Includes timing, caching, and background task helpers

// ============= TIMING & OBSERVABILITY =============

export interface PerformanceMetrics {
  totalMs: number;
  dbMs: number;
  vpsMs: number;
  steps: { name: string; ms: number }[];
}

export class PerformanceTracker {
  private startTime: number;
  private lastStep: number;
  private steps: { name: string; ms: number }[] = [];
  private dbTime = 0;
  private vpsTime = 0;
  private readonly slowThresholdMs: number;
  private readonly functionName: string;

  constructor(functionName: string, slowThresholdMs = 200) {
    this.startTime = performance.now();
    this.lastStep = this.startTime;
    this.slowThresholdMs = slowThresholdMs;
    this.functionName = functionName;
  }

  step(name: string, isDb = false, isVps = false): void {
    const now = performance.now();
    const elapsed = Math.round(now - this.lastStep);
    this.steps.push({ name, ms: elapsed });
    
    if (isDb) this.dbTime += elapsed;
    if (isVps) this.vpsTime += elapsed;
    
    this.lastStep = now;
  }

  getMetrics(): PerformanceMetrics {
    return {
      totalMs: Math.round(performance.now() - this.startTime),
      dbMs: Math.round(this.dbTime),
      vpsMs: Math.round(this.vpsTime),
      steps: this.steps,
    };
  }

  logIfSlow(): void {
    const total = performance.now() - this.startTime;
    if (total > this.slowThresholdMs) {
      const metrics = this.getMetrics();
      console.warn(`⚠️ SLOW_EDGE [${this.functionName}] ${metrics.totalMs}ms`, {
        db: `${metrics.dbMs}ms`,
        vps: `${metrics.vpsMs}ms`,
        steps: metrics.steps,
      });
    }
  }
}

// ============= CACHE HEADERS =============

export interface CacheOptions {
  maxAge?: number;        // seconds
  staleWhileRevalidate?: number;  // seconds
  isPrivate?: boolean;    // user-specific data
  noStore?: boolean;      // sensitive data
}

export function getCacheHeaders(options: CacheOptions = {}): Record<string, string> {
  const {
    maxAge = 30,
    staleWhileRevalidate = 60,
    isPrivate = false,
    noStore = false,
  } = options;

  if (noStore) {
    return { "Cache-Control": "no-store, no-cache, must-revalidate" };
  }

  const directives = [
    isPrivate ? "private" : "public",
    `max-age=${maxAge}`,
    `stale-while-revalidate=${staleWhileRevalidate}`,
  ];

  return { "Cache-Control": directives.join(", ") };
}

// Pre-defined cache profiles
export const CacheProfiles = {
  // No caching - sensitive or user-specific mutable data
  none: { noStore: true },
  
  // Short cache - frequently changing data (30s)
  short: { maxAge: 30, staleWhileRevalidate: 60 },
  
  // Medium cache - metadata, listings (2 min)
  medium: { maxAge: 120, staleWhileRevalidate: 300 },
  
  // Long cache - static/rarely changing (10 min)
  long: { maxAge: 600, staleWhileRevalidate: 1800 },
  
  // Private short cache - user-specific but cacheable
  privateShort: { maxAge: 30, staleWhileRevalidate: 60, isPrivate: true },
  
  // CDN cache for media files (1 hour)
  media: { maxAge: 3600, staleWhileRevalidate: 7200 },
} as const;

// ============= BACKGROUND TASKS =============

/**
 * Fire-and-forget background task using EdgeRuntime.waitUntil
 * Use for non-critical operations like analytics, audit logs, etc.
 */
export function runInBackground(task: () => Promise<void>, taskName?: string): void {
  const wrappedTask = async () => {
    const start = performance.now();
    try {
      await task();
      console.log(`✓ Background [${taskName || 'task'}] ${Math.round(performance.now() - start)}ms`);
    } catch (error) {
      console.error(`✗ Background [${taskName || 'task'}] failed:`, error);
    }
  };

  // Use EdgeRuntime.waitUntil if available (Deno Deploy)
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(wrappedTask());
  } else {
    // Fallback for local development - just run without waiting
    wrappedTask();
  }
}

// ============= RESPONSE HELPERS =============

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(
  data: unknown,
  status = 200,
  cacheOptions?: CacheOptions
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(cacheOptions ? getCacheHeaders(cacheOptions) : {}),
    },
  });
}

export function errorResponse(
  error: string,
  status = 500,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({ error, details }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

export function corsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

// ============= DEBOUNCE FOR WRITES =============

const writeQueue = new Map<string, { data: unknown; timeout: number }>();

/**
 * Debounce writes to reduce DB load
 * Groups writes with same key and only executes the last one
 */
export function debounceWrite(
  key: string,
  writeTask: () => Promise<void>,
  delayMs = 1000
): void {
  const existing = writeQueue.get(key);
  if (existing) {
    clearTimeout(existing.timeout);
  }

  const timeout = setTimeout(async () => {
    writeQueue.delete(key);
    try {
      await writeTask();
    } catch (error) {
      console.error(`Debounced write failed [${key}]:`, error);
    }
  }, delayMs);

  writeQueue.set(key, { data: null, timeout });
}

// Declare EdgeRuntime type for TypeScript
declare const EdgeRuntime: {
  waitUntil?: (promise: Promise<unknown>) => void;
} | undefined;

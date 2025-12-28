// Shared utilities for Edge Functions
// Reduces cold start by having common code in one place

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Default pagination limits
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  FILES_LIMIT: 100,
  MESSAGES_LIMIT: 50,
  AUDIT_LIMIT: 100,
  USERS_LIMIT: 50,
} as const;

// Query budget enforcement
export const QUERY_BUDGET = {
  MAX_ROWS: 100,
  MAX_JOINS: 2,
  MAX_QUERY_TIME_MS: 200,
  WARN_QUERY_TIME_MS: 100,
} as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  ANONYMOUS: { requests: 30, windowMs: 60000 },
  AUTHENTICATED: { requests: 100, windowMs: 60000 },
  HEAVY_OPERATIONS: { requests: 5, windowMs: 60000 },
  DOWNLOAD: { requests: 50, windowMs: 60000 },
  GUEST_DOWNLOAD: { requests: 20, windowMs: 60000 },
} as const;

// API Cost Classification
export const API_COST = {
  CHEAP: ["folder-list", "file-metadata", "share-validate"],
  MEDIUM: ["messages", "files-list", "search"],
  EXPENSIVE: ["zip", "bulk-download", "analytics-export"],
} as const;

// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Abuse tracking
const abuseStore = new Map<string, { violations: number; bannedUntil: number }>();

export function checkRateLimit(
  key: string,
  limit: { requests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  
  // Check if banned
  const abuse = abuseStore.get(key);
  if (abuse && abuse.bannedUntil > now) {
    return { allowed: false, remaining: 0, resetAt: abuse.bannedUntil };
  }
  
  const existing = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) rateLimitStore.delete(k);
    }
  }

  if (!existing || existing.resetAt < now) {
    const resetAt = now + limit.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit.requests - 1, resetAt };
  }

  if (existing.count >= limit.requests) {
    // Track abuse
    trackAbuse(key);
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: limit.requests - existing.count, resetAt: existing.resetAt };
}

// Track and ban abusive clients
export function trackAbuse(key: string): void {
  const existing = abuseStore.get(key) || { violations: 0, bannedUntil: 0 };
  existing.violations++;
  
  // Progressive ban: 1min, 5min, 30min, 1hr, 24hr
  const banDurations = [60000, 300000, 1800000, 3600000, 86400000];
  const banIndex = Math.min(existing.violations - 1, banDurations.length - 1);
  
  if (existing.violations >= 3) {
    existing.bannedUntil = Date.now() + banDurations[banIndex];
    console.warn(`🚫 Banning ${key} for ${banDurations[banIndex] / 1000}s (violations: ${existing.violations})`);
  }
  
  abuseStore.set(key, existing);
}

// Check if client is banned
export function isBanned(key: string): boolean {
  const abuse = abuseStore.get(key);
  return abuse ? abuse.bannedUntil > Date.now() : false;
}

// Get client IP from request
export function getClientIP(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Create rate limited response
export function rateLimitedResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded", retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}

// Performance tracking with metrics collection
export interface PerfMetrics {
  startTime: number;
  checkpoints: { name: string; duration: number }[];
  queryCount: number;
  slowQueries: string[];
}

// Metrics store for observability
const metricsStore = {
  requests: new Map<string, number>(),
  latencies: new Map<string, number[]>(),
  errors: new Map<string, number>(),
  slowQueries: [] as { query: string; duration: number; time: number }[],
  cacheHits: 0,
  cacheMisses: 0,
};

export function startPerfTracking(): PerfMetrics {
  return { startTime: Date.now(), checkpoints: [], queryCount: 0, slowQueries: [] };
}

export function checkpoint(metrics: PerfMetrics, name: string): void {
  const now = Date.now();
  const duration = now - metrics.startTime;
  metrics.checkpoints.push({ name, duration });
}

export function trackQuery(metrics: PerfMetrics, queryName: string, duration: number): void {
  metrics.queryCount++;
  if (duration > QUERY_BUDGET.WARN_QUERY_TIME_MS) {
    metrics.slowQueries.push(queryName);
    metricsStore.slowQueries.push({ query: queryName, duration, time: Date.now() });
    // Keep only last 100 slow queries
    if (metricsStore.slowQueries.length > 100) {
      metricsStore.slowQueries.shift();
    }
  }
}

export function trackCacheHit(): void {
  metricsStore.cacheHits++;
}

export function trackCacheMiss(): void {
  metricsStore.cacheMisses++;
}

export function logPerformance(
  functionName: string,
  metrics: PerfMetrics,
  additionalInfo?: Record<string, unknown>
): void {
  const totalDuration = Date.now() - metrics.startTime;
  
  // Track latency
  const latencies = metricsStore.latencies.get(functionName) || [];
  latencies.push(totalDuration);
  if (latencies.length > 100) latencies.shift();
  metricsStore.latencies.set(functionName, latencies);
  
  // Track request count
  metricsStore.requests.set(
    functionName, 
    (metricsStore.requests.get(functionName) || 0) + 1
  );

  if (totalDuration > QUERY_BUDGET.MAX_QUERY_TIME_MS) {
    console.error(`🔴 SLOW ${functionName}: ${totalDuration}ms`, {
      checkpoints: metrics.checkpoints,
      slowQueries: metrics.slowQueries,
      ...additionalInfo,
    });
  } else if (totalDuration > QUERY_BUDGET.WARN_QUERY_TIME_MS) {
    console.warn(`⚠️ SLOW ${functionName}: ${totalDuration}ms`, {
      checkpoints: metrics.checkpoints,
      ...additionalInfo,
    });
  } else {
    console.log(`✓ ${functionName}: ${totalDuration}ms`);
  }
}

export function trackError(functionName: string): void {
  metricsStore.errors.set(
    functionName,
    (metricsStore.errors.get(functionName) || 0) + 1
  );
}

// Get system metrics for monitoring
export function getSystemMetrics(): {
  requests: Record<string, number>;
  latencyP95: Record<string, number>;
  latencyP99: Record<string, number>;
  avgLatency: Record<string, number>;
  errors: Record<string, number>;
  errorRate: Record<string, number>;
  cacheHitRatio: number;
  slowQueries: { query: string; duration: number; time: number }[];
  rateLimitViolations: number;
  bannedClients: number;
} {
  const requests: Record<string, number> = {};
  const latencyP95: Record<string, number> = {};
  const latencyP99: Record<string, number> = {};
  const avgLatency: Record<string, number> = {};
  const errors: Record<string, number> = {};
  const errorRate: Record<string, number> = {};

  for (const [name, count] of metricsStore.requests) {
    requests[name] = count;
    const latencies = metricsStore.latencies.get(name) || [];
    const sorted = [...latencies].sort((a, b) => a - b);
    
    if (sorted.length > 0) {
      avgLatency[name] = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      latencyP95[name] = sorted[Math.floor(sorted.length * 0.95)] || 0;
      latencyP99[name] = sorted[Math.floor(sorted.length * 0.99)] || 0;
    }
    
    const errorCount = metricsStore.errors.get(name) || 0;
    errors[name] = errorCount;
    errorRate[name] = count > 0 ? Math.round((errorCount / count) * 10000) / 100 : 0;
  }

  const totalCacheOps = metricsStore.cacheHits + metricsStore.cacheMisses;
  const cacheHitRatio = totalCacheOps > 0 
    ? Math.round((metricsStore.cacheHits / totalCacheOps) * 10000) / 100 
    : 0;

  // Count active rate limit violations and bans
  let rateLimitViolations = 0;
  let bannedClients = 0;
  const now = Date.now();
  
  for (const abuse of abuseStore.values()) {
    rateLimitViolations += abuse.violations;
    if (abuse.bannedUntil > now) bannedClients++;
  }

  return {
    requests,
    latencyP95,
    latencyP99,
    avgLatency,
    errors,
    errorRate,
    cacheHitRatio,
    slowQueries: metricsStore.slowQueries.slice(-20),
    rateLimitViolations,
    bannedClients,
  };
}

// VPS Configuration
export const VPS_CONFIG = {
  endpoint: "http://46.38.232.46:4000",
  apiKey: "kARTOOS007",
} as const;

// Pagination helper
export function getPaginationParams(url: URL): { limit: number; offset: number } {
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || String(PAGINATION.DEFAULT_LIMIT), 10),
    PAGINATION.MAX_LIMIT
  );
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  return { limit: Math.max(1, limit), offset: Math.max(0, offset) };
}

// Sanitize and validate pagination for body requests
export function sanitizePagination(body: { limit?: number; offset?: number }): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(body.limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const offset = body.offset || 0;
  return { limit: Math.max(1, limit), offset: Math.max(0, offset) };
}

// Error response helper
export function errorResponse(
  message: string,
  status: number,
  details?: unknown
): Response {
  console.error(`Error (${status}): ${message}`, details);
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Success response helper  
export function jsonResponse(data: unknown, status = 200, cacheSeconds = 0): Response {
  const headers: Record<string, string> = { 
    ...corsHeaders, 
    "Content-Type": "application/json" 
  };
  
  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  }
  
  return new Response(JSON.stringify(data), { status, headers });
}

// Validate query doesn't exceed budget
export function enforceQueryBudget(rowCount: number, queryTime: number): { 
  ok: boolean; 
  degraded: boolean;
  message?: string;
} {
  if (rowCount > QUERY_BUDGET.MAX_ROWS) {
    return { 
      ok: false, 
      degraded: true,
      message: `Query returned ${rowCount} rows, max allowed is ${QUERY_BUDGET.MAX_ROWS}` 
    };
  }
  
  if (queryTime > QUERY_BUDGET.MAX_QUERY_TIME_MS) {
    return { 
      ok: true, 
      degraded: true,
      message: `Query took ${queryTime}ms, budget is ${QUERY_BUDGET.MAX_QUERY_TIME_MS}ms` 
    };
  }
  
  return { ok: true, degraded: false };
}

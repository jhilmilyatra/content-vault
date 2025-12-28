// Shared utilities for Edge Functions
// Reduces cold start by having common code in one place

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
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

// Rate limiting configuration
export const RATE_LIMITS = {
  // Per IP per minute
  ANONYMOUS: { requests: 30, windowMs: 60000 },
  // Per user per minute  
  AUTHENTICATED: { requests: 100, windowMs: 60000 },
  // For heavy operations (ZIP, bulk downloads)
  HEAVY_OPERATIONS: { requests: 5, windowMs: 60000 },
} as const;

// In-memory rate limit store (resets on cold start, which is acceptable)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: { requests: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) rateLimitStore.delete(k);
    }
  }

  if (!existing || existing.resetAt < now) {
    // New window
    const resetAt = now + limit.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit.requests - 1, resetAt };
  }

  if (existing.count >= limit.requests) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: limit.requests - existing.count, resetAt: existing.resetAt };
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

// Performance tracking
export interface PerfMetrics {
  startTime: number;
  checkpoints: { name: string; duration: number }[];
}

export function startPerfTracking(): PerfMetrics {
  return { startTime: Date.now(), checkpoints: [] };
}

export function checkpoint(metrics: PerfMetrics, name: string): void {
  const now = Date.now();
  const duration = now - metrics.startTime;
  metrics.checkpoints.push({ name, duration });
}

export function logPerformance(
  functionName: string,
  metrics: PerfMetrics,
  additionalInfo?: Record<string, unknown>
): void {
  const totalDuration = Date.now() - metrics.startTime;
  const slowThreshold = 200; // ms

  if (totalDuration > slowThreshold) {
    console.warn(`⚠️ SLOW ${functionName}: ${totalDuration}ms`, {
      checkpoints: metrics.checkpoints,
      ...additionalInfo,
    });
  } else {
    console.log(`✓ ${functionName}: ${totalDuration}ms`);
  }
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
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

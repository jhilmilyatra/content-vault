/**
 * Guest HLS URL Signing Edge Function
 * 
 * Generates HMAC-signed URLs for secure HLS streaming for guest users.
 * Checks if HLS is available and falls back to direct streaming if not.
 * 
 * Features:
 * - Guest access validation via RPC
 * - VPS HLS availability check
 * - Time-limited HMAC-SHA256 signed URLs
 * - Fallback to regular stream URL if HLS unavailable
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// VPS Configuration - uses environment variables only
// VPS_ENDPOINT = internal HTTP for server-to-server (health checks, HLS status, etc.)
// VPS_CDN_URL = public HTTPS URL for client-facing URLs (Cloudflare proxied)
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_CDN_URL = Deno.env.get("VPS_CDN_URL") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

// Signing secret for URL tokens
const SIGNING_SECRET = Deno.env.get("HLS_SIGNING_SECRET") || VPS_API_KEY || "default-signing-secret";

/**
 * Validate URL is HTTPS - critical for mixed content prevention
 */
function ensureHttps(url: string): string {
  if (url.startsWith("https://")) {
    return url;
  }
  console.error(`❌ SECURITY: Attempted to return HTTP URL to client: ${url}`);
  throw new Error("Insecure media URL blocked - HTTPS required");
}

/**
 * Generate HMAC signature for signed URLs
 */
async function generateSignature(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// TTL: 12 hours for signed URLs
// This ensures long-form video playback (3-4+ hours) never hits expiry
// HLS re-fetches playlists repeatedly - short TTLs break playback
const TWELVE_HOURS = 12 * 60 * 60; // 43200 seconds

/**
 * Generate a signed HLS URL (12-hour validity)
 */
async function generateSignedHLSUrl(
  hlsPath: string, 
  expiresInSeconds: number = TWELVE_HOURS
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const message = `${hlsPath}${expires}`;
  const signature = await generateSignature(message);
  
  // Return HTTPS CDN URL for client
  const url = `${VPS_CDN_URL}${hlsPath}?exp=${expires}&sig=${signature}`;
  return ensureHttps(url);
}

/**
 * Generate a signed direct stream URL (12-hour validity)
 */
async function generateSignedStreamUrl(
  storagePath: string, 
  guestId: string,
  expiresInSeconds: number = TWELVE_HOURS
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const message = `${storagePath}:${guestId}:${expires}`;
  const signature = await generateSignature(message);
  
  const params = new URLSearchParams({
    path: storagePath,
    guest: guestId,
    expires: String(expires),
    sig: signature,
  });
  
  // Return HTTPS CDN URL for client
  const url = `${VPS_CDN_URL}/stream?${params.toString()}`;
  return ensureHttps(url);
}

interface HLSStatus {
  hasHLS: boolean;
  status?: string;
  progress?: number;
  qualities?: Array<{ name: string; resolution: string }>;
  playlistUrl?: string;
}

/**
 * Check HLS availability on VPS
 * Uses HEAD request first for quick check, then GET for full data if available
 */
async function checkHLSStatus(userId: string, fileName: string): Promise<HLSStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Internal HTTP call to VPS (server-to-server)
    const headResponse = await fetch(
      `${VPS_ENDPOINT}/hls-status/${userId}/${fileName}`,
      {
        method: "HEAD",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    
    if (!headResponse.ok) {
      return { hasHLS: false };
    }
    
    // HLS exists - get full status with GET (internal HTTP call)
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 3000);
    
    const getResponse = await fetch(
      `${VPS_ENDPOINT}/hls-status/${userId}/${fileName}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
        },
        signal: controller2.signal,
      }
    );
    clearTimeout(timeoutId2);
    
    if (!getResponse.ok) {
      return { hasHLS: false };
    }
    
    const data = await getResponse.json();
    return data;
  } catch (error) {
    console.warn("HLS status check failed:", error);
    return { hasHLS: false };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const { guestId, storagePath } = await req.json();

    if (!guestId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "Missing guestId or storagePath" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Guest HLS URL request: guestId=${guestId}, path=${storagePath}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Validate guest
    const { data: guestData, error: guestError } = await supabaseAdmin
      .from("guest_users")
      .select("id, is_banned")
      .eq("id", guestId)
      .single();

    if (guestError || !guestData) {
      return new Response(
        JSON.stringify({ error: "Guest not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guestData.is_banned) {
      return new Response(
        JSON.stringify({ error: "Account is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file access
    const { data: accessData, error: accessError } = await supabaseAdmin
      .rpc('check_guest_file_access', {
        p_guest_id: guestId,
        p_storage_path: storagePath
      });

    if (accessError) {
      console.error("Access check error:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to verify access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessResult = accessData?.[0];
    
    if (!accessResult || !accessResult.has_access) {
      const status = accessResult?.file_id ? 403 : 404;
      const error = accessResult?.file_id ? "Access denied" : "File not found";
      return new Response(
        JSON.stringify({ error }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if file is a video
    const mimeType = accessResult.file_mime_type || '';
    const isVideo = mimeType.startsWith('video/');
    
    if (!isVideo) {
      // Not a video - return direct stream URL
      const streamUrl = await generateSignedStreamUrl(storagePath, guestId);
      return new Response(
        JSON.stringify({
          type: 'stream',
          url: streamUrl,
          hlsAvailable: false,
          file: {
            id: accessResult.file_id,
            name: accessResult.file_name,
            original_name: accessResult.file_original_name,
            mime_type: accessResult.file_mime_type,
            size: accessResult.file_size,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse storage path to check HLS
    const pathParts = storagePath.split('/');
    const userId = pathParts[0];
    const fileName = pathParts.pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');

    // Check HLS availability
    const hlsStatus = await checkHLSStatus(userId, fileName);
    
    if (hlsStatus.hasHLS) {
      // HLS is available - generate signed HLS URL
      const hlsPath = `/hls/${userId}/${baseName}/index.m3u8`;
      const hlsUrl = await generateSignedHLSUrl(hlsPath);
      
      const totalTime = performance.now() - startTime;
      console.log(`✅ HLS URL generated: ${Math.round(totalTime)}ms, qualities=${hlsStatus.qualities?.length || 0}`);
      
      return new Response(
        JSON.stringify({
          type: 'hls',
          url: hlsUrl,
          hlsAvailable: true,
          qualities: hlsStatus.qualities || [],
          file: {
            id: accessResult.file_id,
            name: accessResult.file_name,
            original_name: accessResult.file_original_name,
            mime_type: accessResult.file_mime_type,
            size: accessResult.file_size,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HLS not available - return direct stream URL with status
    const streamUrl = await generateSignedStreamUrl(storagePath, guestId);
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Stream URL generated (HLS unavailable): ${Math.round(totalTime)}ms, status=${hlsStatus.status || 'not_started'}`);
    
    return new Response(
      JSON.stringify({
        type: 'stream',
        url: streamUrl,
        hlsAvailable: false,
        hlsStatus: hlsStatus.status || 'not_started',
        hlsProgress: hlsStatus.progress,
        file: {
          id: accessResult.file_id,
          name: accessResult.file_name,
          original_name: accessResult.file_original_name,
          mime_type: accessResult.file_mime_type,
          size: accessResult.file_size,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Guest HLS URL error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

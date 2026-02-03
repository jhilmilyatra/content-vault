import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFeatureEnabled, featureDisabledResponse } from "../_shared/feature-flags.ts";

/**
 * Video Streaming Endpoint - Direct MP4 Streaming via CDN
 * 
 * Features:
 * - Generates signed CDN URLs for MP4 streaming
 * - Long TTL (12 hours) for uninterrupted playback
 * - Clean URL structure: /video-stream?id={file_id}
 * - Returns CDN URL for direct MP4 playback with range request support
 * - Feature flag check for video streaming
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Signing secret for URL tokens
const SIGNING_SECRET = Deno.env.get("HLS_SIGNING_SECRET") || Deno.env.get("VPS_API_KEY") || "default-signing-secret";

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

/**
 * Generate a signed streaming URL for CDN access
 * Long TTL (12 hours) for uninterrupted playback of long videos
 */
async function generateSignedStreamUrl(
  cdnBaseUrl: string,
  storagePath: string, 
  userId: string,
  expiresInSeconds: number = 43200 // 12 hours default
): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const message = `${storagePath}:${userId}:${expires}`;
  const signature = await generateSignature(message);
  
  const params = new URLSearchParams({
    path: storagePath,
    guest: userId,
    expires: String(expires),
    sig: signature,
  });
  
  // Normalize URL - remove trailing slashes
  const normalizedBase = cdnBaseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/stream?${params.toString()}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check feature flag
    const videoStreamingEnabled = await isFeatureEnabled(supabaseAdmin, 'feature_video_streaming');
    if (!videoStreamingEnabled) {
      return featureDisabledResponse('Video streaming', corsHeaders);
    }
    
    // VPS CDN URL for HTTPS streaming
    const vpsCdnUrl = Deno.env.get("VPS_CDN_URL") || "";
    const vpsEndpoint = Deno.env.get("VPS_ENDPOINT") || "";
    const vpsApiKey = Deno.env.get("VPS_API_KEY") || "";
    
    const hasCdnUrl = vpsCdnUrl && vpsCdnUrl.startsWith("https://");
    const hasVps = vpsEndpoint && vpsApiKey;

    const url = new URL(req.url);
    
    // Support both GET params and POST body
    let fileId = url.searchParams.get("id");
    let storagePath = url.searchParams.get("path");
    
    // Parse POST body if present
    if (req.method === "POST") {
      try {
        const body = await req.json();
        fileId = body.fileId || body.id || fileId;
        storagePath = body.storagePath || body.path || storagePath;
      } catch {
        // Body parsing failed, continue with URL params
      }
    }

    if (!fileId && !storagePath) {
      return new Response(
        JSON.stringify({ error: "Missing file ID or path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalStoragePath = storagePath;
    let fileInfo = null;

    // If file ID provided, look up the file
    if (fileId) {
      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("id, name, original_name, mime_type, size_bytes, storage_path, user_id, thumbnail_url, duration_seconds")
        .eq("id", fileId)
        .single();

      if (fileError || !file) {
        return new Response(
          JSON.stringify({ error: "File not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user owns the file
      if (file.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized access" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalStoragePath = file.storage_path;
      fileInfo = {
        id: file.id,
        name: file.name,
        originalName: file.original_name,
        mimeType: file.mime_type,
        size: file.size_bytes,
        thumbnailUrl: file.thumbnail_url,
        durationSeconds: file.duration_seconds,
      };
    } else {
      // Direct path access - verify ownership
      if (!finalStoragePath?.startsWith(user.id + "/")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized access" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate MP4 streaming URLs
    const streamUrls: Record<string, unknown> = {
      fileInfo,
      storage: "vps",
      type: "mp4",
    };

    // Check if transcoded 480p.mp4 exists (web-compatible H.264)
    // This is preferred over original as it's guaranteed to play in all browsers
    const fileName = finalStoragePath!.split('/').pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const userId = finalStoragePath!.split('/')[0];
    const transcodedPath = `${userId}/hls/${baseName}/480p.mp4`;
    
    // Try to check if 480p transcoded version exists on VPS
    let useTranscoded = false;
    if (hasVps) {
      try {
        const vpsApiKey = Deno.env.get("VPS_API_KEY") || "";
        const checkUrl = `${vpsEndpoint}/verify-file`;
        const checkResp = await fetch(checkUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${vpsApiKey}`
          },
          body: JSON.stringify({ path: transcodedPath }),
        });
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          useTranscoded = checkData.exists === true;
        }
      } catch (e) {
        console.log("Could not check for transcoded version:", e);
      }
    }

    // Primary: Use transcoded 480p if available, otherwise original
    const primaryPath = useTranscoded ? transcodedPath : finalStoragePath!;
    
    if (hasCdnUrl) {
      streamUrls.url = await generateSignedStreamUrl(vpsCdnUrl, primaryPath, user.id, 43200);
      streamUrls.type = "cdn";
      
      // If using transcoded, provide original as fallback for full quality
      if (useTranscoded) {
        streamUrls.fallbackUrl = await generateSignedStreamUrl(vpsCdnUrl, finalStoragePath!, user.id, 43200);
      }
    } else if (hasVps) {
      streamUrls.url = await generateSignedStreamUrl(vpsEndpoint, primaryPath, user.id, 43200);
      streamUrls.type = "vps-direct";
      
      if (useTranscoded) {
        streamUrls.fallbackUrl = await generateSignedStreamUrl(vpsEndpoint, finalStoragePath!, user.id, 43200);
      }
    }

    // If no transcoded version and no fallback yet, try Supabase storage
    if (!streamUrls.fallbackUrl) {
      try {
        const { data: supabaseData, error: supabaseError } = await supabase.storage
          .from("user-files")
          .createSignedUrl(finalStoragePath!, 43200);
        
        if (!supabaseError && supabaseData?.signedUrl) {
          streamUrls.fallbackUrl = supabaseData.signedUrl;
        }
      } catch (e) {
        console.log("Supabase fallback not available:", e);
      }
    }

    // Return streaming URLs with CDN-optimized cache headers
    return new Response(
      JSON.stringify(streamUrls),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          // Cache the signed URL response for 2 hours (URLs are valid for 12 hours)
          "Cache-Control": "private, max-age=7200, stale-while-revalidate=3600",
          // Hint for CDN to avoid caching auth-dependent responses
          "CDN-Cache-Control": "no-store",
          "Vary": "Authorization",
        } 
      }
    );

  } catch (error: unknown) {
    console.error("Video stream error:", error);
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

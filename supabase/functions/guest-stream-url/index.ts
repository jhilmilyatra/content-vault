import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFeatureEnabled, featureDisabledResponse } from "../_shared/feature-flags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// VPS Configuration
// VPS_ENDPOINT = internal HTTP for server-to-server (health checks)
// VPS_CDN_URL = public HTTPS URL for client-facing URLs (Cloudflare proxied)
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_CDN_URL = Deno.env.get("VPS_CDN_URL") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

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
 * Generate a signed streaming URL
 */
async function generateSignedUrl(
  storagePath: string, 
  guestId: string,
  expiresInSeconds: number = 7200
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
  
  // Use the HTTPS CDN URL for client-facing URLs
  return `${VPS_CDN_URL}/stream?${params.toString()}`;
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

    console.log(`Generating stream URL: guestId=${guestId}, path=${storagePath}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check feature flag
    const videoStreamingEnabled = await isFeatureEnabled(supabaseAdmin, 'feature_video_streaming');
    if (!videoStreamingEnabled) {
      return featureDisabledResponse('Video streaming', corsHeaders);
    }

    // Quick guest validation
    const { data: guestData, error: guestError } = await supabaseAdmin
      .from("guest_users")
      .select("id, is_banned")
      .eq("id", guestId)
      .single();

    if (guestError || !guestData) {
      console.error("Guest not found:", guestError);
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

    // Use optimized RPC for access check + file info
    const { data: accessData, error: accessError } = await supabaseAdmin
      .rpc('check_guest_file_access', {
        p_guest_id: guestId,
        p_storage_path: storagePath
      });

    const dbTime = performance.now() - startTime;
    console.log(`DB access check: ${Math.round(dbTime)}ms`);

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

    // Check if VPS CDN is properly configured (must be HTTPS)
    const hasCdnUrl = VPS_CDN_URL && VPS_CDN_URL.startsWith("https://");
    const hasVpsEndpoint = VPS_ENDPOINT && VPS_API_KEY;

    // Try VPS if CDN is configured
    if (hasCdnUrl && hasVpsEndpoint) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const healthCheck = await fetch(`${VPS_ENDPOINT}/health`, {
          headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (healthCheck.ok) {
          // Generate signed VPS streaming URL (HTTPS via CDN)
          const streamUrl = await generateSignedUrl(storagePath, guestId, 7200);
          
          const totalTime = performance.now() - startTime;
          console.log(`✅ Generated signed VPS URL: ${Math.round(totalTime)}ms`);
          
          return new Response(
            JSON.stringify({
              url: streamUrl,
              type: 'vps',
              file: {
                id: accessResult.file_id,
                name: accessResult.file_name,
                original_name: accessResult.file_original_name,
                mime_type: accessResult.file_mime_type,
                size: accessResult.file_size,
              },
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
      } catch (e) {
        console.warn("VPS health check failed, using Supabase fallback:", e);
      }
    }

    // Fallback to Supabase signed URL
    console.log("Using Supabase storage fallback");
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from("user-files")
      .createSignedUrl(storagePath, 7200);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Storage unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTime = performance.now() - startTime;
    console.log(`✅ Generated Supabase fallback URL: ${Math.round(totalTime)}ms`);

    return new Response(
      JSON.stringify({
        url: signedUrlData.signedUrl,
        type: 'supabase',
        file: {
          id: accessResult.file_id,
          name: accessResult.file_name,
          original_name: accessResult.file_original_name,
          mime_type: accessResult.file_mime_type,
          size: accessResult.file_size,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Stream URL generation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

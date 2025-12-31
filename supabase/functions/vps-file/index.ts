import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
};

// Performance tracking
const VPS_TIMEOUT_MS = 8000; // Increased timeout for reliability

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
 * Generate a signed streaming URL for VPS access
 */
async function generateSignedVpsUrl(
  cdnBaseUrl: string,
  storagePath: string, 
  userId: string,
  expiresInSeconds: number = 3600
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
  
  // Normalize URL - remove trailing slashes from base URL
  const normalizedBase = cdnBaseUrl.replace(/\/+$/, '');
  return `${normalizedBase}/stream?${params.toString()}`;
}

Deno.serve(async (req) => {
  const startTime = performance.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // VPS_ENDPOINT = internal HTTP for server-to-server health checks
    // VPS_CDN_URL = public HTTPS URL for client-facing URLs (Cloudflare proxied)
    const envVpsEndpoint = Deno.env.get("VPS_ENDPOINT") || "";
    const envVpsCdnUrl = Deno.env.get("VPS_CDN_URL") || "";
    const envVpsApiKey = Deno.env.get("VPS_API_KEY") || "";
    
    // Check if CDN URL is properly configured (must be HTTPS)
    const hasCdnUrl = envVpsCdnUrl && envVpsCdnUrl.startsWith("https://");
    const hasVpsEndpoint = envVpsEndpoint && envVpsApiKey;

    const url = new URL(req.url);
    const storagePath = url.searchParams.get("path");
    const action = url.searchParams.get("action") || "get"; // get, delete, url

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "No path provided" }),
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

    // Verify user owns the file
    if (!storagePath.startsWith(user.id + "/")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: URL ===
    // Returns a direct URL for the client to use (for downloads, video playback, etc.)
    if (action === "url") {
      // Try to get Supabase fallback URL (may not exist if file is VPS-only)
      let fallbackUrl: string | null = null;
      try {
        const { data: supabaseUrlData, error: supabaseUrlError } = await supabase.storage
          .from("user-files")
          .createSignedUrl(storagePath, 7200);
        
        if (!supabaseUrlError && supabaseUrlData?.signedUrl) {
          fallbackUrl = supabaseUrlData.signedUrl;
        } else {
          console.log("Supabase fallback not available:", supabaseUrlError?.message || "No signed URL");
        }
      } catch (e) {
        console.log("Supabase fallback generation failed:", e);
      }
      
      // Try VPS if configured
      if (hasCdnUrl && hasVpsEndpoint) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const healthCheck = await fetch(`${envVpsEndpoint}/health`, {
            headers: { "Authorization": `Bearer ${envVpsApiKey}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (healthCheck.ok) {
            const signedUrl = await generateSignedVpsUrl(envVpsCdnUrl, storagePath, user.id, 7200);
            
            console.log(`✅ Generated signed VPS URL via CDN`);
            
            // If no Supabase fallback, generate a direct VPS endpoint fallback
            const directVpsFallback = fallbackUrl || `${envVpsEndpoint}/stream?path=${encodeURIComponent(storagePath)}`;
            
            return new Response(
              JSON.stringify({ 
                url: signedUrl, 
                fallbackUrl: fallbackUrl || directVpsFallback,
                storage: "vps",
                signed: true
              }),
              { 
                status: 200, 
                headers: { 
                  ...corsHeaders, 
                  "Content-Type": "application/json",
                  "Cache-Control": "private, max-age=60"
                } 
              }
            );
          }
        } catch (e) {
          console.warn("VPS health check failed, falling back to Supabase:", e);
        }
      }
      
      // VPS unavailable - use Supabase if available
      if (fallbackUrl) {
        console.log("Using Supabase signed URL");
        return new Response(
          JSON.stringify({ 
            url: fallbackUrl, 
            storage: "cloud",
            signed: true
          }),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=60"
            } 
          }
        );
      }
      
      // Last resort - try VPS endpoint directly without CDN
      if (hasVpsEndpoint) {
        console.log("Using direct VPS endpoint (no CDN)");
        const directUrl = await generateSignedVpsUrl(envVpsEndpoint, storagePath, user.id, 7200);
        return new Response(
          JSON.stringify({ 
            url: directUrl, 
            storage: "vps-direct",
            signed: true
          }),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=60"
            } 
          }
        );
      }
      
      console.error("No storage available");
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: DELETE ===
    if (action === "delete") {
      const pathParts = storagePath.split("/");
      if (pathParts.length < 2) {
        return new Response(
          JSON.stringify({ error: "Invalid storage path format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = pathParts[0];
      const fileName = pathParts.slice(1).join("/");

      // Delete from VPS if configured
      if (hasVpsEndpoint) {
        try {
          const deleteResponse = await fetch(`${envVpsEndpoint}/delete`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${envVpsApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, fileName }),
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ Deleted from VPS: ${storagePath}`);
          } else {
            console.log(`VPS delete returned: ${deleteResponse.status}`);
          }
        } catch (e) {
          console.error("VPS delete error:", e);
        }
      }
      
      // Also delete from Supabase storage (if it exists there)
      await supabase.storage.from("user-files").remove([storagePath]);
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: GET (stream/redirect for video playback) ===
    if (action === "get") {
      // Try Supabase first - most reliable
      try {
        const { data: supabaseData, error: supabaseError } = await supabase.storage
          .from("user-files")
          .createSignedUrl(storagePath, 3600);
        
        if (!supabaseError && supabaseData?.signedUrl) {
          console.log("GET: Redirecting to Supabase signed URL");
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              "Location": supabaseData.signedUrl,
              "Cache-Control": "no-cache"
            }
          });
        }
      } catch (e) {
        console.log("Supabase signed URL failed:", e);
      }
      
      // Supabase doesn't have the file - try VPS
      if (hasVpsEndpoint) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Stream directly from VPS through edge function
          const vpsStreamUrl = `${envVpsEndpoint}/stream?path=${encodeURIComponent(storagePath)}`;
          const vpsResponse = await fetch(vpsStreamUrl, {
            headers: { "Authorization": `Bearer ${envVpsApiKey}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (vpsResponse.ok && vpsResponse.body) {
            console.log("GET: Streaming from VPS");
            const contentType = vpsResponse.headers.get("content-type") || "application/octet-stream";
            const contentLength = vpsResponse.headers.get("content-length");
            
            const headers: Record<string, string> = {
              ...corsHeaders,
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=3600",
            };
            
            if (contentLength) {
              headers["Content-Length"] = contentLength;
            }
            
            return new Response(vpsResponse.body, {
              status: 200,
              headers,
            });
          }
        } catch (e) {
          console.warn("VPS stream failed:", e);
        }
      }
      
      return new Response(
        JSON.stringify({ error: "File not available" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("File operation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

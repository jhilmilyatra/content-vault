import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
};

// Performance tracking
const SLOW_THRESHOLD_MS = 200;

Deno.serve(async (req) => {
  const startTime = performance.now();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Primary VPS storage - hardcoded
    const envVpsEndpoint = "http://46.38.232.46:4000";
    const envVpsApiKey = "kARTOOS007";

    // Custom VPS from headers
    const headerVpsEndpoint = req.headers.get("x-vps-endpoint");
    const headerVpsApiKey = req.headers.get("x-vps-api-key");

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
    
    const authTime = performance.now() - startTime;
    
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

    // Determine which VPS to use
    const vpsEndpoint = headerVpsEndpoint || envVpsEndpoint;
    const vpsApiKey = headerVpsApiKey || envVpsApiKey;

    if (action === "url") {
      // Get URL for file
      if (vpsEndpoint && vpsApiKey) {
        // Check if file exists on VPS
        const vpsStartTime = performance.now();
        try {
          const checkResponse = await fetch(`${vpsEndpoint}/files/${storagePath}`, {
            method: "HEAD",
            headers: { "Authorization": `Bearer ${vpsApiKey}` },
          });
          
          const vpsTime = performance.now() - vpsStartTime;
          
          if (checkResponse.ok) {
            const totalTime = performance.now() - startTime;
            if (totalTime > SLOW_THRESHOLD_MS) {
              console.warn(`⚠️ SLOW_EDGE [vps-file:url] ${Math.round(totalTime)}ms (auth: ${Math.round(authTime)}ms, vps: ${Math.round(vpsTime)}ms)`);
            }
            
            return new Response(
              JSON.stringify({ url: `${vpsEndpoint}/files/${storagePath}`, storage: "vps" }),
              { 
                status: 200, 
                headers: { 
                  ...corsHeaders, 
                  "Content-Type": "application/json",
                  // ✅ CACHE: Cache URL responses
                  "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
                } 
              }
            );
          }
        } catch (e) {
          console.log("VPS check failed, trying Supabase");
        }
      }
      
      // Fallback to Supabase signed URL
      const { data, error } = await supabase.storage
        .from("user-files")
        .createSignedUrl(storagePath, 3600);
      
      if (error) throw error;
      
      const totalTime = performance.now() - startTime;
      if (totalTime > SLOW_THRESHOLD_MS) {
        console.warn(`⚠️ SLOW_EDGE [vps-file:url-fallback] ${Math.round(totalTime)}ms`);
      }
      
      return new Response(
        JSON.stringify({ url: data.signedUrl, storage: "cloud" }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120"
          } 
        }
      );
    }

    if (action === "delete") {
      // Parse userId and fileName from storagePath
      const pathParts = storagePath.split("/");
      if (pathParts.length < 2) {
        return new Response(
          JSON.stringify({ error: "Invalid storage path format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = pathParts[0];
      const fileName = pathParts.slice(1).join("/");

      // Delete from VPS
      if (vpsEndpoint && vpsApiKey) {
        try {
          const deleteResponse = await fetch(`${vpsEndpoint}/delete`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${vpsApiKey}`,
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
      
      const totalTime = performance.now() - startTime;
      if (totalTime > SLOW_THRESHOLD_MS) {
        console.warn(`⚠️ SLOW_EDGE [vps-file:delete] ${Math.round(totalTime)}ms`);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get") {
      // Try VPS first
      if (vpsEndpoint && vpsApiKey) {
        const vpsStartTime = performance.now();
        try {
          const vpsResponse = await fetch(`${vpsEndpoint}/files/${storagePath}`, {
            headers: { "Authorization": `Bearer ${vpsApiKey}` },
          });
          
          const vpsTime = performance.now() - vpsStartTime;
          
          if (vpsResponse.ok) {
            const contentType = vpsResponse.headers.get("Content-Type") || "application/octet-stream";
            
            const totalTime = performance.now() - startTime;
            if (totalTime > SLOW_THRESHOLD_MS) {
              console.warn(`⚠️ SLOW_EDGE [vps-file:get] ${Math.round(totalTime)}ms (auth: ${Math.round(authTime)}ms, vps: ${Math.round(vpsTime)}ms)`);
            }
            
            // Stream response directly (don't buffer with blob())
            return new Response(vpsResponse.body, {
              headers: { 
                ...corsHeaders, 
                "Content-Type": contentType,
                // ✅ CACHE: Allow CDN to cache files
                "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
              },
            });
          }
        } catch (e) {
          console.error("VPS get error:", e);
        }
      }
      
      // Fallback to Supabase storage
      const { data, error } = await supabase.storage
        .from("user-files")
        .download(storagePath);
      
      if (error) throw error;
      
      const totalTime = performance.now() - startTime;
      if (totalTime > SLOW_THRESHOLD_MS) {
        console.warn(`⚠️ SLOW_EDGE [vps-file:get-fallback] ${Math.round(totalTime)}ms`);
      }
      
      return new Response(data, {
        headers: { 
          ...corsHeaders, 
          "Content-Type": data.type,
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
        },
      });
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

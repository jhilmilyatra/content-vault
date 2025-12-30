import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Performance tracking
const SLOW_THRESHOLD_MS = 200;

// Primary VPS storage - hardcoded same as fileService
const VPS_CONFIG = {
  endpoint: "http://46.38.232.46:4000",
  apiKey: "kARTOOS007",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const { guestId, storagePath, action } = await req.json();

    console.log(`Guest file stream request: guestId=${guestId}, path=${storagePath}, action=${action}`);

    if (!guestId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "Guest ID and storage path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify guest exists and is not banned (quick check)
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

    // ✅ OPTIMIZED: Single RPC call for file access check + file info
    const { data: accessData, error: accessError } = await supabaseAdmin
      .rpc('check_guest_file_access', {
        p_guest_id: guestId,
        p_storage_path: storagePath
      });

    const dbTime = performance.now() - startTime;

    if (accessError) {
      console.error("Access check error:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to verify access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessResult = accessData?.[0];
    
    if (!accessResult || !accessResult.has_access) {
      return new Response(
        JSON.stringify({ error: accessResult?.file_id ? "Access denied" : "File not found" }),
        { status: accessResult?.file_id ? 403 : 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileData = {
      id: accessResult.file_id,
      folder_id: accessResult.folder_id,
      name: accessResult.file_name,
      original_name: accessResult.file_original_name,
      mime_type: accessResult.file_mime_type,
      size_bytes: accessResult.file_size,
    };

    // Size limits for preview - large files should use download instead
    const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100MB max for preview
    const isLargeFile = fileData.size_bytes > MAX_PREVIEW_SIZE;
    
    // For large files that aren't video/audio, suggest download instead
    const isStreamable = fileData.mime_type.startsWith("video/") || fileData.mime_type.startsWith("audio/");
    
    if (isLargeFile && !isStreamable && action !== 'download') {
      console.log(`File too large for preview: ${fileData.size_bytes} bytes`);
      return new Response(
        JSON.stringify({ 
          error: "File too large for preview",
          suggestDownload: true,
          size: fileData.size_bytes,
          fileName: fileData.original_name
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to get file from VPS first
    const vpsStartTime = performance.now();
    console.log(`Fetching file from VPS: ${VPS_CONFIG.endpoint}/files/${storagePath}`);
    
    try {
      // Just check if file exists on VPS with HEAD request
      const vpsCheckResponse = await fetch(`${VPS_CONFIG.endpoint}/files/${storagePath}`, {
        method: "HEAD",
        headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
      });
      
      const vpsTime = performance.now() - vpsStartTime;
      
      if (vpsCheckResponse.ok) {
        // VPS has the file - create a proxy URL through this edge function
        const proxyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/guest-file-proxy?guestId=${encodeURIComponent(guestId)}&path=${encodeURIComponent(storagePath)}`;
        
        const totalTime = performance.now() - startTime;
        if (totalTime > SLOW_THRESHOLD_MS) {
          console.warn(`⚠️ SLOW_EDGE [guest-file-stream] ${Math.round(totalTime)}ms (db: ${Math.round(dbTime)}ms, vps: ${Math.round(vpsTime)}ms)`);
        }
        
        console.log(`VPS file found, returning proxy URL in ${Math.round(totalTime)}ms`);
        return new Response(
          JSON.stringify({ 
            url: proxyUrl,
            fileName: fileData.original_name,
            mimeType: fileData.mime_type,
            size: fileData.size_bytes,
            source: "vps"
          }),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              "Content-Type": "application/json",
              // ✅ CACHE: Cache file URL for 2 minutes
              "Cache-Control": "public, max-age=120, stale-while-revalidate=300"
            } 
          }
        );
      } else {
        console.log(`VPS returned ${vpsCheckResponse.status}, trying Supabase storage`);
      }
    } catch (vpsError) {
      console.error("VPS fetch error:", vpsError);
    }

    // Fallback: Try Supabase storage
    console.log("Trying Supabase storage fallback...");
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from("user-files")
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Supabase signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "File not found in storage" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalTime = performance.now() - startTime;
    if (totalTime > SLOW_THRESHOLD_MS) {
      console.warn(`⚠️ SLOW_EDGE [guest-file-stream] ${Math.round(totalTime)}ms (supabase fallback)`);
    }

    return new Response(
      JSON.stringify({ 
        url: signedUrlData.signedUrl,
        fileName: fileData.original_name,
        mimeType: fileData.mime_type,
        size: fileData.size_bytes,
        source: "supabase"
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          // ✅ CACHE: Cache signed URLs (they expire in 1 hour anyway)
          "Cache-Control": "public, max-age=120, stale-while-revalidate=300"
        } 
      }
    );
  } catch (error) {
    console.error("Guest file stream error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

// VPS timeout for availability check (ms)
const VPS_CHECK_TIMEOUT = 3000;

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
    const MAX_PREVIEW_SIZE = 500 * 1024 * 1024; // 500MB max for preview
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

    // Try to verify file exists on VPS with HEAD request (with timeout)
    const vpsStartTime = performance.now();
    let vpsAvailable = false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VPS_CHECK_TIMEOUT);
      
      const vpsCheckResponse = await fetch(`${VPS_CONFIG.endpoint}/files/${storagePath}`, {
        method: "HEAD",
        headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      vpsAvailable = vpsCheckResponse.ok;
      
      const vpsTime = performance.now() - vpsStartTime;
      console.log(`VPS check: ${vpsAvailable ? 'available' : 'not found'} in ${Math.round(vpsTime)}ms`);
    } catch (vpsError: unknown) {
      const errorMessage = vpsError instanceof Error ? vpsError.message : String(vpsError);
      console.error("VPS check error (timeout or network):", errorMessage);
      // VPS unavailable, fall back to Supabase storage
    }

    if (vpsAvailable) {
      // ✅ KEY FIX: Return DIRECT VPS URL instead of proxy URL
      // The VPS /files endpoint is public and handles range requests properly
      // This avoids edge function timeouts and enables proper video streaming
      const directVpsUrl = `${VPS_CONFIG.endpoint}/files/${storagePath}`;
      
      const totalTime = performance.now() - startTime;
      if (totalTime > SLOW_THRESHOLD_MS) {
        console.warn(`⚠️ SLOW_EDGE [guest-file-stream] ${Math.round(totalTime)}ms (db: ${Math.round(dbTime)}ms)`);
      }
      
      console.log(`✅ Returning direct VPS URL for streaming: ${Math.round(totalTime)}ms`);
      
      // Record file view asynchronously (don't block response)
      (async () => {
        try {
          await supabaseAdmin.rpc('record_file_view', {
            p_file_id: fileData.id,
            p_guest_id: guestId,
            p_view_type: 'stream',
            p_bytes_transferred: fileData.size_bytes
          });
          console.log(`📊 Recorded view: file=${fileData.id}, guest=${guestId}`);
        } catch (err) {
          console.error('Failed to record view:', err);
        }
      })();
      
      return new Response(
        JSON.stringify({ 
          url: directVpsUrl,
          fileName: fileData.original_name,
          mimeType: fileData.mime_type,
          size: fileData.size_bytes,
          source: "vps-direct",
          // Include streaming hints for the client
          streaming: {
            supportsRange: true,
            supportsHLS: fileData.mime_type.startsWith("video/"),
          }
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            // ✅ CACHE: Cache file URL for 5 minutes (file URLs are stable)
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600"
          } 
        }
      );
    }

    // Fallback: Try Supabase storage
    console.log("VPS unavailable, trying Supabase storage fallback...");
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

    // Record file view for Supabase fallback
    (async () => {
      try {
        await supabaseAdmin.rpc('record_file_view', {
          p_file_id: fileData.id,
          p_guest_id: guestId,
          p_view_type: 'stream',
          p_bytes_transferred: fileData.size_bytes
        });
      } catch (err) {
        console.error('Failed to record view:', err);
      }
    })();

    return new Response(
      JSON.stringify({ 
        url: signedUrlData.signedUrl,
        fileName: fileData.original_name,
        mimeType: fileData.mime_type,
        size: fileData.size_bytes,
        source: "supabase",
        streaming: {
          supportsRange: true,
          supportsHLS: false,
        }
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

// VPS Configuration - uses environment variables only
// VPS_ENDPOINT = internal HTTP for server-to-server (streaming, file access)
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

// Timeouts
const VPS_TIMEOUT = 30000; // 30 seconds for streaming

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const url = new URL(req.url);
    const guestId = url.searchParams.get("guestId");
    const storagePath = url.searchParams.get("path");

    if (!guestId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "Missing guestId or path parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Guest file proxy: guestId=${guestId}, path=${storagePath}, method=${req.method}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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

    const fileData = {
      id: accessResult.file_id,
      name: accessResult.file_name,
      original_name: accessResult.file_original_name,
      mime_type: accessResult.file_mime_type,
      size_bytes: accessResult.file_size,
    };

    // Handle HEAD requests for video players to get file metadata
    if (req.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": fileData.mime_type || "application/octet-stream",
          "Content-Length": String(fileData.size_bytes),
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Get range header from client
    const rangeHeader = req.headers.get("Range");
    const fileSize = fileData.size_bytes;

    console.log(`Streaming: range=${rangeHeader || 'full'}, size=${fileSize}, type=${fileData.mime_type}`);

    // Build VPS request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VPS_TIMEOUT);

    const vpsHeaders: Record<string, string> = {
      "Authorization": `Bearer ${VPS_API_KEY}`,
    };

    // Forward range header for video seeking
    if (rangeHeader) {
      vpsHeaders["Range"] = rangeHeader;
    }

    let vpsResponse: Response;
    try {
      // Internal HTTP call to VPS (server-to-server, proxied through edge function)
      vpsResponse = await fetch(`${VPS_ENDPOINT}/files/${storagePath}`, {
        headers: vpsHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error(`VPS fetch error: ${errorMessage}`);
      
      // Fallback to Supabase storage
      console.log("Attempting Supabase storage fallback...");
      const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
        .storage
        .from("user-files")
        .createSignedUrl(storagePath, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return new Response(
          JSON.stringify({ error: "Storage server unavailable" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Redirect to Supabase signed URL
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": signedUrlData.signedUrl,
        },
      });
    }

    if (!vpsResponse.ok && vpsResponse.status !== 206) {
      console.error(`VPS response error: ${vpsResponse.status} ${vpsResponse.statusText}`);
      
      // Try Supabase fallback
      const { data: signedUrlData } = await supabaseAdmin
        .storage
        .from("user-files")
        .createSignedUrl(storagePath, 3600);

      if (signedUrlData?.signedUrl) {
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            "Location": signedUrlData.signedUrl,
          },
        });
      }

      return new Response(
        JSON.stringify({ error: "File not found on storage" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate bytes for analytics
    let bytesTransferred = fileSize;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : fileSize - 1;
        bytesTransferred = end - start + 1;
      }
    }

    // Record view asynchronously
    (async () => {
      try {
        const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                        req.headers.get("cf-connecting-ip") || null;
        const userAgent = req.headers.get("user-agent") || null;
        
        await supabaseAdmin.rpc('record_file_view', {
          p_file_id: fileData.id,
          p_guest_id: guestId,
          p_ip_address: clientIp,
          p_user_agent: userAgent,
          p_view_type: rangeHeader ? 'stream' : 'preview',
          p_bytes_transferred: bytesTransferred
        });
        console.log(`📊 View recorded: file=${fileData.id}, bytes=${bytesTransferred}`);
      } catch (err) {
        console.error('View recording failed:', err);
      }
    })();

    // Build response headers
    const contentType = fileData.mime_type || "application/octet-stream";
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    };

    // Handle partial content response (206)
    if (vpsResponse.status === 206 || rangeHeader) {
      const contentRange = vpsResponse.headers.get("Content-Range");
      const contentLength = vpsResponse.headers.get("Content-Length");
      
      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
      } else if (rangeHeader && fileSize) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1]);
          const end = match[2] ? parseInt(match[2]) : fileSize - 1;
          responseHeaders["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
          responseHeaders["Content-Length"] = String(end - start + 1);
        }
      }
      
      if (contentLength && !responseHeaders["Content-Length"]) {
        responseHeaders["Content-Length"] = contentLength;
      }

      const totalTime = performance.now() - startTime;
      console.log(`✅ Streaming 206 response: ${Math.round(totalTime)}ms`);

      return new Response(vpsResponse.body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    // Full file response (200)
    responseHeaders["Content-Length"] = String(fileSize);
    responseHeaders["Content-Disposition"] = `inline; filename="${encodeURIComponent(fileData.original_name)}"`;

    const totalTime = performance.now() - startTime;
    console.log(`✅ Full file response: ${Math.round(totalTime)}ms`);

    return new Response(vpsResponse.body, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("Guest file proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

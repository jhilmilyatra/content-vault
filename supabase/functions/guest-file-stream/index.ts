import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Primary VPS storage - hardcoded same as fileService
const VPS_CONFIG = {
  endpoint: "http://46.38.232.46:4000",
  apiKey: "kARTOOS007",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Verify guest exists and is not banned
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

    // Get file info from storage path
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from("files")
      .select("id, folder_id, user_id, name, original_name, mime_type, size_bytes")
      .eq("storage_path", storagePath)
      .eq("is_deleted", false)
      .single();

    if (fileError || !fileData) {
      console.error("File not found in DB:", fileError);
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify guest has access to this file's folder
    const hasAccess = await verifyGuestFileAccess(supabaseAdmin, guestId, fileData.folder_id);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    console.log(`Fetching file from VPS: ${VPS_CONFIG.endpoint}/files/${storagePath}`);
    
    try {
      // Just check if file exists on VPS with HEAD request
      const vpsCheckResponse = await fetch(`${VPS_CONFIG.endpoint}/files/${storagePath}`, {
        method: "HEAD",
        headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
      });
      
      if (vpsCheckResponse.ok) {
        // VPS has the file - create a proxy URL through this edge function
        const proxyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/guest-file-proxy?guestId=${encodeURIComponent(guestId)}&path=${encodeURIComponent(storagePath)}`;
        
        console.log(`VPS file found, returning proxy URL`);
        return new Response(
          JSON.stringify({ 
            url: proxyUrl,
            fileName: fileData.original_name,
            mimeType: fileData.mime_type,
            size: fileData.size_bytes,
            source: "vps"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    return new Response(
      JSON.stringify({ 
        url: signedUrlData.signedUrl,
        fileName: fileData.original_name,
        mimeType: fileData.mime_type,
        size: fileData.size_bytes,
        source: "supabase"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest file stream error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function verifyGuestFileAccess(
  supabase: any,
  guestId: string,
  folderId: string | null
): Promise<boolean> {
  if (!folderId) return false;

  // Get all shared folder IDs the guest has access to
  const { data: accessData } = await supabase
    .from("guest_folder_access")
    .select("folder_share_id")
    .eq("guest_id", guestId)
    .eq("is_restricted", false);

  if (!accessData || accessData.length === 0) {
    return false;
  }

  const folderShareIds = accessData.map((a: any) => a.folder_share_id);

  // Get folder_ids from folder_shares
  const { data: sharesData } = await supabase
    .from("folder_shares")
    .select("folder_id")
    .in("id", folderShareIds)
    .eq("is_active", true);

  const sharedFolderIds = (sharesData || []).map((s: any) => s.folder_id);

  if (sharedFolderIds.length === 0) {
    return false;
  }

  // Check if file's folder is one of the shared folders
  if (sharedFolderIds.includes(folderId)) {
    return true;
  }

  // Check if file's folder is a subfolder of any shared folder
  let currentId = folderId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const { data: currentFolder } = await supabase
      .from("folders")
      .select("id, parent_id")
      .eq("id", currentId)
      .single();

    if (!currentFolder) break;

    if (sharedFolderIds.includes(currentFolder.id)) {
      return true;
    }

    if (currentFolder.parent_id && sharedFolderIds.includes(currentFolder.parent_id)) {
      return true;
    }

    currentId = currentFolder.parent_id;
  }

  return false;
}

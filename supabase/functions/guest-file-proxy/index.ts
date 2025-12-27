import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const url = new URL(req.url);
    const guestId = url.searchParams.get("guestId");
    const storagePath = url.searchParams.get("path");

    if (!guestId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "Missing parameters" }),
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
      .select("id, folder_id, user_id, name, original_name, mime_type")
      .eq("storage_path", storagePath)
      .eq("is_deleted", false)
      .single();

    if (fileError || !fileData) {
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

    // Fetch file from VPS only - no Supabase fallback for large file optimization
    console.log(`Fetching file from VPS: ${VPS_CONFIG.endpoint}/files/${storagePath}`);
    
    const vpsResponse = await fetch(`${VPS_CONFIG.endpoint}/files/${storagePath}`, {
      headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
    });

    if (!vpsResponse.ok) {
      console.error(`VPS fetch failed: ${vpsResponse.status} ${vpsResponse.statusText}`);
      return new Response(
        JSON.stringify({ error: "File not found on storage server" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the VPS response directly
    const contentType = vpsResponse.headers.get("Content-Type") || fileData.mime_type || "application/octet-stream";
    
    return new Response(vpsResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileData.original_name}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Guest file proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch file" }),
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

  const { data: accessData } = await supabase
    .from("guest_folder_access")
    .select("folder_share_id")
    .eq("guest_id", guestId)
    .eq("is_restricted", false);

  if (!accessData || accessData.length === 0) {
    return false;
  }

  const folderShareIds = accessData.map((a: any) => a.folder_share_id);

  const { data: sharesData } = await supabase
    .from("folder_shares")
    .select("folder_id")
    .in("id", folderShareIds)
    .eq("is_active", true);

  const sharedFolderIds = (sharesData || []).map((s: any) => s.folder_id);

  if (sharedFolderIds.length === 0) {
    return false;
  }

  if (sharedFolderIds.includes(folderId)) {
    return true;
  }

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

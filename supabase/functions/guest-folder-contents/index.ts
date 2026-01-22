import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache headers for folder listings (short TTL)
const cacheHeaders = {
  "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { guestId, folderId, fileId, action } = body;

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: "Guest ID is required" }),
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

    // Handle different actions
    if (action === "verify-access") {
      const hasAccess = await verifyFolderAccess(supabaseAdmin, guestId, folderId);
      return new Response(
        JSON.stringify({ hasAccess }),
        { 
          status: 200, 
          headers: { ...corsHeaders, ...cacheHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Get file info by file ID (for video player)
    if (action === "get-file-info" && fileId) {
      // Get file with folder info
      const { data: fileData, error: fileError } = await supabaseAdmin
        .from("files")
        .select("id, name, original_name, mime_type, size_bytes, storage_path, folder_id, duration_seconds, thumbnail_url")
        .eq("id", fileId)
        .eq("is_deleted", false)
        .single();

      if (fileError || !fileData) {
        return new Response(
          JSON.stringify({ error: "File not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify guest has access to file's folder
      const accessResult = await verifyFolderAccess(supabaseAdmin, guestId, fileData.folder_id);
      if (!accessResult.hasAccess) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ file: fileData }),
        { 
          status: 200, 
          headers: { ...corsHeaders, ...cacheHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (action === "get-contents") {
      // First verify access
      const accessResult = await verifyFolderAccess(supabaseAdmin, guestId, folderId);
      if (!accessResult.hasAccess) {
        return new Response(
          JSON.stringify({ error: "Access denied", hasAccess: false }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parallel fetch for better performance
      const [folderResult, subfoldersResult, filesResult] = await Promise.all([
        // Get folder details
        supabaseAdmin
          .from("folders")
          .select("id, name, description, parent_id")
          .eq("id", folderId)
          .single(),
        // Get subfolders
        supabaseAdmin
          .from("folders")
          .select("id, name, description, parent_id")
          .eq("parent_id", folderId)
          .order("name"),
        // Get files - include duration_seconds for video badges
        supabaseAdmin
          .from("files")
          .select("id, name, original_name, mime_type, size_bytes, storage_path, duration_seconds, thumbnail_url")
          .eq("folder_id", folderId)
          .eq("is_deleted", false)
          .order("name"),
      ]);

      if (folderResult.error || !folderResult.data) {
        return new Response(
          JSON.stringify({ error: "Folder not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build breadcrumbs
      const breadcrumbs = await buildBreadcrumbs(supabaseAdmin, guestId, folderId, folderResult.data);

      return new Response(
        JSON.stringify({
          folder: folderResult.data,
          subfolders: subfoldersResult.data || [],
          files: filesResult.data || [],
          breadcrumbs,
          rootFolderId: accessResult.rootFolderId,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, ...cacheHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest folder contents error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function verifyFolderAccess(
  supabase: any,
  guestId: string,
  targetFolderId: string
): Promise<{ hasAccess: boolean; rootFolderId: string | null }> {
  // Get all shared folder IDs the guest has access to
  const { data: accessData } = await supabase
    .from("guest_folder_access")
    .select("folder_share_id")
    .eq("guest_id", guestId)
    .eq("is_restricted", false);

  if (!accessData || accessData.length === 0) {
    return { hasAccess: false, rootFolderId: null };
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
    return { hasAccess: false, rootFolderId: null };
  }

  // Check if target folder is one of the shared folders
  if (sharedFolderIds.includes(targetFolderId)) {
    return { hasAccess: true, rootFolderId: targetFolderId };
  }

  // Check if target folder is a subfolder of any shared folder
  let currentId = targetFolderId;
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
      return { hasAccess: true, rootFolderId: currentFolder.id };
    }

    if (currentFolder.parent_id && sharedFolderIds.includes(currentFolder.parent_id)) {
      return { hasAccess: true, rootFolderId: currentFolder.parent_id };
    }

    currentId = currentFolder.parent_id;
  }

  return { hasAccess: false, rootFolderId: null };
}

async function buildBreadcrumbs(
  supabase: any,
  guestId: string,
  folderId: string,
  currentFolder: any
): Promise<{ id: string; name: string }[]> {
  const crumbs: { id: string; name: string }[] = [];

  // Get shared folder IDs for the guest
  const { data: accessData } = await supabase
    .from("guest_folder_access")
    .select("folder_share_id")
    .eq("guest_id", guestId)
    .eq("is_restricted", false);

  const folderShareIds = (accessData || []).map((a: any) => a.folder_share_id);

  const { data: sharesData } = await supabase
    .from("folder_shares")
    .select("folder_id")
    .in("id", folderShareIds)
    .eq("is_active", true);

  const sharedFolderIds = (sharesData || []).map((s: any) => s.folder_id);

  // Build path from current folder up to shared folder
  let currentId = folderId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);

    const { data: folder } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single();

    if (!folder) break;

    crumbs.unshift({ id: folder.id, name: folder.name });

    // Stop if we've reached a shared folder
    if (sharedFolderIds.includes(folder.id)) {
      break;
    }

    currentId = folder.parent_id;
  }

  return crumbs;
}

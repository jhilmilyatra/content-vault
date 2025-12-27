import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestId, storagePath, action } = await req.json();

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

    // Generate signed URL for the file
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from("user-files")
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Error creating signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate file URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        url: signedUrlData.signedUrl,
        fileName: fileData.original_name,
        mimeType: fileData.mime_type,
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

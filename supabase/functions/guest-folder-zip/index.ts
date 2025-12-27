import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Primary VPS storage
const VPS_CONFIG = {
  endpoint: "http://46.38.232.46:4000",
  apiKey: "kARTOOS007",
};

interface FileItem {
  id: string;
  name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { guestId, folderId } = await req.json();

    if (!guestId || !folderId) {
      return new Response(
        JSON.stringify({ error: "Guest ID and folder ID are required" }),
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

    // Verify guest has access to this folder
    const hasAccess = await verifyGuestFolderAccess(supabaseAdmin, guestId, folderId);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get folder info
    const { data: folderData, error: folderError } = await supabaseAdmin
      .from("folders")
      .select("id, name")
      .eq("id", folderId)
      .single();

    if (folderError || !folderData) {
      return new Response(
        JSON.stringify({ error: "Folder not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect all files recursively
    const allFiles: { file: FileItem; relativePath: string }[] = [];
    await collectFolderFiles(supabaseAdmin, folderId, "", allFiles);

    if (allFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files in folder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check total size (limit to 500MB for memory safety)
    const totalSize = allFiles.reduce((sum, f) => sum + f.file.size_bytes, 0);
    if (totalSize > 500 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Folder too large to download as ZIP (max 500MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create ZIP file using JSZip
    const zip = new JSZip();

    console.log(`Creating ZIP with ${allFiles.length} files`);

    for (const { file, relativePath } of allFiles) {
      try {
        // Fetch from VPS only - no Supabase fallback for large file optimization
        const vpsResponse = await fetch(`${VPS_CONFIG.endpoint}/files/${file.storage_path}`, {
          headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
        });
        
        if (vpsResponse.ok) {
          const arrayBuffer = await vpsResponse.arrayBuffer();
          const filePath = relativePath ? `${relativePath}/${file.original_name}` : file.original_name;
          zip.file(filePath, arrayBuffer);
          console.log(`Added to ZIP: ${filePath}`);
        } else {
          console.warn(`VPS fetch failed for ${file.original_name}: ${vpsResponse.status}`);
        }
      } catch (e) {
        console.error(`Error adding file ${file.name} to ZIP:`, e);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folderData.name}.zip"`,
      },
    });
  } catch (error) {
    console.error("Guest folder ZIP error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create ZIP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function collectFolderFiles(
  supabase: any,
  folderId: string,
  currentPath: string,
  results: { file: FileItem; relativePath: string }[]
) {
  // Get files in this folder
  const { data: files } = await supabase
    .from("files")
    .select("id, name, original_name, storage_path, mime_type, size_bytes")
    .eq("folder_id", folderId)
    .eq("is_deleted", false);

  if (files) {
    for (const file of files) {
      results.push({ file, relativePath: currentPath });
    }
  }

  // Get subfolders
  const { data: subfolders } = await supabase
    .from("folders")
    .select("id, name")
    .eq("parent_id", folderId);

  if (subfolders) {
    for (const subfolder of subfolders) {
      const newPath = currentPath ? `${currentPath}/${subfolder.name}` : subfolder.name;
      await collectFolderFiles(supabase, subfolder.id, newPath, results);
    }
  }
}

async function verifyGuestFolderAccess(
  supabase: any,
  guestId: string,
  folderId: string
): Promise<boolean> {
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

  // Check if folder is a subfolder of any shared folder
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limits
const MAX_FILES_IN_ZIP = 500;
const MAX_ZIP_SIZE = 500 * 1024 * 1024; // 500MB
const RATE_LIMIT = { requests: 3, windowMs: 60000 }; // 3 ZIP requests per minute
const FILE_FETCH_TIMEOUT = 30000; // 30 seconds per file

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  
  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT.requests) return false;
  existing.count++;
  return true;
}

// VPS Configuration - uses environment variables only
const VPS_CONFIG = {
  endpoint: Deno.env.get("VPS_ENDPOINT") || "",
  apiKey: Deno.env.get("VPS_API_KEY") || "",
};

interface FileItem {
  id: string;
  name: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { guestId, folderId } = await req.json();

    if (!guestId || !folderId) {
      return new Response(
        JSON.stringify({ error: "Guest ID and folder ID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit by guest ID for heavy operations
    if (!checkRateLimit(`zip:${guestId}`)) {
      return new Response(
        JSON.stringify({ error: "Too many ZIP requests. Please wait a minute.", retryAfter: 60 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
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

    // Collect files with limit
    const allFiles: { file: FileItem; relativePath: string }[] = [];
    await collectFolderFiles(supabaseAdmin, folderId, "", allFiles, MAX_FILES_IN_ZIP);

    if (allFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files in folder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check total size
    const totalSize = allFiles.reduce((sum, f) => sum + f.file.size_bytes, 0);
    if (totalSize > MAX_ZIP_SIZE) {
      return new Response(
        JSON.stringify({ error: "Folder too large to download as ZIP (max 500MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating ZIP with ${allFiles.length} files (${Math.round(totalSize / 1024 / 1024)}MB)`);

    // Create ZIP file
    const zip = new JSZip();
    let filesAdded = 0;
    let filesSkipped = 0;

    // Process files one by one with retry logic
    for (const { file, relativePath } of allFiles) {
      try {
        const vpsResponse = await fetchWithTimeout(
          `${VPS_CONFIG.endpoint}/files/${file.storage_path}`,
          { headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` } },
          FILE_FETCH_TIMEOUT
        );
        
        if (vpsResponse.ok) {
          const arrayBuffer = await vpsResponse.arrayBuffer();
          const filePath = relativePath ? `${relativePath}/${file.original_name}` : file.original_name;
          zip.file(filePath, arrayBuffer);
          filesAdded++;
        } else {
          console.warn(`Failed to fetch ${file.storage_path}: ${vpsResponse.status}`);
          filesSkipped++;
        }
      } catch (fetchError) {
        console.warn(`Error fetching ${file.storage_path}:`, fetchError);
        filesSkipped++;
        // Continue with other files
      }
    }

    if (filesAdded === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch any files. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });

    const duration = Date.now() - startTime;
    console.log(`✓ ZIP created: ${filesAdded} files (${filesSkipped} skipped) in ${duration}ms`);

    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folderData.name}.zip"`,
        "X-Files-Added": String(filesAdded),
        "X-Files-Skipped": String(filesSkipped),
      },
    });
  } catch (error) {
    console.error("Guest folder ZIP error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create ZIP. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function collectFolderFiles(
  supabase: any,
  folderId: string,
  currentPath: string,
  results: { file: FileItem; relativePath: string }[],
  maxFiles: number
) {
  if (results.length >= maxFiles) return;

  // Get files with LIMIT
  const remaining = maxFiles - results.length;
  const { data: files } = await supabase
    .from("files")
    .select("id, name, original_name, storage_path, mime_type, size_bytes")
    .eq("folder_id", folderId)
    .eq("is_deleted", false)
    .limit(remaining);

  if (files) {
    for (const file of files) {
      if (results.length >= maxFiles) break;
      results.push({ file, relativePath: currentPath });
    }
  }

  if (results.length >= maxFiles) return;

  // Get subfolders with LIMIT
  const { data: subfolders } = await supabase
    .from("folders")
    .select("id, name")
    .eq("parent_id", folderId)
    .limit(50);

  if (subfolders) {
    for (const subfolder of subfolders) {
      if (results.length >= maxFiles) break;
      const newPath = currentPath ? `${currentPath}/${subfolder.name}` : subfolder.name;
      await collectFolderFiles(supabase, subfolder.id, newPath, results, maxFiles);
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
    .eq("is_restricted", false)
    .limit(100);

  if (!accessData || accessData.length === 0) return false;

  const folderShareIds = accessData.map((a: any) => a.folder_share_id);

  const { data: sharesData } = await supabase
    .from("folder_shares")
    .select("folder_id")
    .in("id", folderShareIds)
    .eq("is_active", true)
    .limit(100);

  const sharedFolderIds = (sharesData || []).map((s: any) => s.folder_id);
  if (sharedFolderIds.length === 0) return false;
  if (sharedFolderIds.includes(folderId)) return true;

  // Check parent hierarchy with depth limit
  let currentId = folderId;
  const visited = new Set<string>();
  let depth = 0;
  const maxDepth = 20;

  while (currentId && !visited.has(currentId) && depth < maxDepth) {
    visited.add(currentId);
    depth++;

    const { data: currentFolder } = await supabase
      .from("folders")
      .select("id, parent_id")
      .eq("id", currentId)
      .single();

    if (!currentFolder) break;
    if (sharedFolderIds.includes(currentFolder.id)) return true;
    if (currentFolder.parent_id && sharedFolderIds.includes(currentFolder.parent_id)) return true;

    currentId = currentFolder.parent_id;
  }

  return false;
}

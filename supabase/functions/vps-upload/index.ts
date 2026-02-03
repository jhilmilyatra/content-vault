import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper function to convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

interface VPSUploadRequest {
  fileName: string;
  fileData: string; // base64 encoded
  mimeType: string;
  userId: string;
  folderId?: string;
  vpsEndpoint?: string;
  vpsApiKey?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Direct VPS storage - hardcoded for reliable uploads
    const VPS_ENDPOINT = "https://cloudvaults.in";
    const VPS_API_KEY = "kARTOOS@007";
    
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
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    
    let fileName: string;
    let fileData: Uint8Array;
    let mimeType: string;
    let folderId: string | null = null;
    let customVpsEndpoint: string | null = null;
    let customVpsApiKey: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await req.formData();
      const file = formData.get("file") as File;
      folderId = formData.get("folderId") as string | null;
      customVpsEndpoint = formData.get("vpsEndpoint") as string | null;
      customVpsApiKey = formData.get("vpsApiKey") as string | null;
      
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      fileName = file.name;
      mimeType = file.type;
      fileData = new Uint8Array(await file.arrayBuffer());
    } else {
      // Handle JSON request with base64 data
      const body: VPSUploadRequest = await req.json();
      fileName = body.fileName;
      mimeType = body.mimeType;
      folderId = body.folderId || null;
      customVpsEndpoint = body.vpsEndpoint || null;
      customVpsApiKey = body.vpsApiKey || null;
      
      // Decode base64
      const binaryString = atob(body.fileData);
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    }

    // Use hardcoded VPS settings - ignore custom overrides for simplicity
    const vpsEndpoint = VPS_ENDPOINT;
    const vpsApiKey = VPS_API_KEY;

    console.log(`📦 Uploading to VPS: ${vpsEndpoint}`);
    
    // Convert file data to base64 using chunked approach (avoids stack overflow)
    const base64Data = uint8ArrayToBase64(fileData);
    
    // Determine the correct upload URL
    // If endpoint ends with /api, use that path, otherwise append /upload-base64
    let uploadUrl = vpsEndpoint;
    if (uploadUrl.endsWith('/')) {
      uploadUrl = uploadUrl.slice(0, -1);
    }
    
    // Handle different endpoint formats:
    // - https://domain.com -> https://domain.com/api/upload-base64
    // - https://domain.com/api -> https://domain.com/api/upload-base64
    // - http://ip:4000 -> http://ip:4000/upload-base64
    if (uploadUrl.includes('/api')) {
      uploadUrl = uploadUrl.replace(/\/api\/?$/, '') + '/api/upload-base64';
    } else if (uploadUrl.match(/:\d+$/)) {
      // Direct port access (e.g., http://ip:4000)
      uploadUrl = `${uploadUrl}/upload-base64`;
    } else {
      // HTTPS domain without /api path
      uploadUrl = `${uploadUrl}/api/upload-base64`;
    }
    
    console.log(`📤 Upload URL: ${uploadUrl}`);
    
    const vpsResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vpsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: fileName,
        originalName: fileName,
        mimeType: mimeType,
        data: base64Data,
        userId: user.id,
      }),
    });

    if (!vpsResponse.ok) {
      const errorText = await vpsResponse.text();
      console.error(`VPS response error (${vpsResponse.status}): ${errorText}`);
      return new Response(
        JSON.stringify({ error: `VPS upload failed: ${vpsResponse.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vpsResult = await vpsResponse.json();
    
    // Use the path returned by VPS server
    const storagePath = vpsResult.path;
    
    // Construct file URL
    const fileUrl = `${VPS_ENDPOINT}${vpsResult.url}`;
    const storageType = "vps";
    const usedNode = VPS_ENDPOINT;
    
    console.log(`✅ VPS upload successful: ${storagePath} via ${usedNode}`);

    // Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: user.id,
        folder_id: folderId,
        name: fileName,
        original_name: fileName,
        mime_type: mimeType,
        size_bytes: fileData.length,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to create file record", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        file: fileRecord,
        storageType,
        url: fileUrl,
        node: usedNode,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

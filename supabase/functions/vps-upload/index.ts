import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VPSUploadRequest {
  fileName: string;
  fileData: string; // base64 encoded
  mimeType: string;
  userId: string;
  folderId?: string;
  vpsEndpoint?: string;
  vpsApiKey?: string;
}

interface StorageNode {
  id: string;
  endpoint: string;
  apiKey: string;
  priority: number;
  totalStorage: number;
  usedStorage: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Primary VPS storage - hardcoded
    const envVpsEndpoint = "http://46.38.232.46:4000";
    const envVpsApiKey = "kARTOOS007";
    
    // Custom VPS from headers (for additional nodes)
    const headerVpsEndpoint = req.headers.get("x-vps-endpoint");
    const headerVpsApiKey = req.headers.get("x-vps-api-key");
    
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

    let fileUrl: string;
    let storageType: "vps" | "cloud";
    let usedNode: string | null = null;
    let storagePath: string;

    // Determine which VPS to use (priority: custom > header > env)
    const vpsEndpoint = customVpsEndpoint || headerVpsEndpoint || envVpsEndpoint;
    const vpsApiKey = customVpsApiKey || headerVpsApiKey || envVpsApiKey;

    // Try VPS storage first
    if (vpsEndpoint && vpsApiKey) {
      try {
        console.log(`📦 Uploading to VPS: ${vpsEndpoint}`);
        
        // Convert file data to base64
        const base64Data = btoa(String.fromCharCode(...fileData));
        
        const vpsResponse = await fetch(`${vpsEndpoint}/upload-base64`, {
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
          console.error(`VPS response error: ${errorText}`);
          throw new Error(`VPS upload failed: ${vpsResponse.status} - ${errorText}`);
        }

        const vpsResult = await vpsResponse.json();
        
        // Use the path returned by VPS server (it generates the actual filename)
        storagePath = vpsResult.path;
        fileUrl = `${vpsEndpoint}${vpsResult.url}`;
        storageType = "vps";
        usedNode = vpsEndpoint;
        
        console.log(`✅ VPS upload successful: ${storagePath}`);
      } catch (vpsError) {
        console.error("VPS upload error, falling back to cloud:", vpsError);
        
        // Generate cloud storage path for fallback
        const fileExt = fileName.split(".").pop();
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        storagePath = `${user.id}/${uniqueFileName}`;
        
        // Fallback to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from("user-files")
          .upload(storagePath, fileData, {
            contentType: mimeType,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from("user-files")
          .getPublicUrl(storagePath);
        
        fileUrl = urlData.publicUrl;
        storageType = "cloud";
      }
    } else {
      // Use Supabase storage directly
      console.log("☁️ Uploading to cloud storage (no VPS configured)");
      
      // Generate cloud storage path
      const fileExt = fileName.split(".").pop();
      const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
      storagePath = `${user.id}/${uniqueFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("user-files")
        .upload(storagePath, fileData, {
          contentType: mimeType,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from("user-files")
        .getPublicUrl(storagePath);
      
      fileUrl = urlData.publicUrl;
      storageType = "cloud";
    }

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

    if (dbError) throw dbError;

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

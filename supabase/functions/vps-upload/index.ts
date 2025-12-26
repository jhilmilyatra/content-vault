import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VPSUploadRequest {
  fileName: string;
  fileData: string; // base64 encoded
  mimeType: string;
  userId: string;
  folderId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vpsEndpoint = Deno.env.get("VPS_STORAGE_ENDPOINT");
    const vpsApiKey = Deno.env.get("VPS_STORAGE_API_KEY");
    
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

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await req.formData();
      const file = formData.get("file") as File;
      folderId = formData.get("folderId") as string | null;
      
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
      
      // Decode base64
      const binaryString = atob(body.fileData);
      fileData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fileData[i] = binaryString.charCodeAt(i);
      }
    }

    // Generate unique file path
    const fileExt = fileName.split(".").pop();
    const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `${user.id}/${uniqueFileName}`;

    let fileUrl: string;
    let storageType: "vps" | "cloud";

    // Check if VPS storage is configured
    if (vpsEndpoint && vpsApiKey) {
      // Upload to VPS
      try {
        const vpsResponse = await fetch(`${vpsEndpoint}/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${vpsApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: storagePath,
            fileName: uniqueFileName,
            originalName: fileName,
            mimeType: mimeType,
            data: btoa(String.fromCharCode(...fileData)),
            userId: user.id,
          }),
        });

        if (!vpsResponse.ok) {
          throw new Error(`VPS upload failed: ${vpsResponse.statusText}`);
        }

        const vpsResult = await vpsResponse.json();
        fileUrl = vpsResult.url || `${vpsEndpoint}/files/${storagePath}`;
        storageType = "vps";
      } catch (vpsError) {
        console.error("VPS upload error, falling back to cloud:", vpsError);
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
      // Use Supabase storage
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

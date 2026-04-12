import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VPS_ENDPOINT = Deno.env.get("VPS_CDN_URL") || "https://cloudvaults.in";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "kARTOOS@007";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    let fileBlob: Blob;
    let mimeType: string;
    let folderId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
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
      mimeType = file.type || "application/octet-stream";
      fileBlob = file;
    } else {
      // Handle JSON request with base64 data
      const body = await req.json();
      fileName = body.fileName;
      mimeType = body.mimeType || "application/octet-stream";

      // Decode base64
      const binaryString = atob(body.fileData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBlob = new Blob([bytes], { type: mimeType });
      folderId = body.folderId || null;
    }

    console.log(`📦 Uploading to VPS via edge function: ${fileName} (${fileBlob.size} bytes)`);

    // Forward as multipart/form-data to VPS (more efficient than base64)
    const vpsFormData = new FormData();
    vpsFormData.append("file", fileBlob, fileName);
    vpsFormData.append("userId", user.id);

    const vpsResponse = await fetch(`${VPS_ENDPOINT}/api/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VPS_API_KEY}`,
      },
      body: vpsFormData,
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
    const storagePath = vpsResult.path;

    console.log(`✅ VPS upload successful: ${storagePath}`);

    // Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: user.id,
        folder_id: folderId,
        name: vpsResult.fileName || fileName,
        original_name: fileName,
        mime_type: mimeType,
        size_bytes: fileBlob.size,
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
        storagePath,
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

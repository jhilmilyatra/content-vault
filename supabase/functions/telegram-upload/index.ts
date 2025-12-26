import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface TelegramUploadRequest {
  file_name: string;
  file_data: string; // Base64 encoded file data
  mime_type: string;
  folder_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      console.log("Missing API key");
      return new Response(
        JSON.stringify({ error: "Missing API key. Include x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify API key by finding the user
    // API key format: user_id:secret (we'll use first part as user_id)
    const [userId, secret] = apiKey.split(":");
    
    if (!userId || !secret) {
      console.log("Invalid API key format");
      return new Response(
        JSON.stringify({ error: "Invalid API key format. Use format: user_id:secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      console.log("Invalid user ID:", profileError);
      return new Response(
        JSON.stringify({ error: "Invalid API key - user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: TelegramUploadRequest = await req.json();
    const { file_name, file_data, mime_type, folder_id } = body;

    if (!file_name || !file_data || !mime_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_name, file_data, mime_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing upload for user ${userId}: ${file_name}`);

    // Decode base64 file data
    const binaryString = atob(file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const fileExt = file_name.split(".").pop() || "bin";
    const storageName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `${userId}/${storageName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(storagePath, bytes, {
        contentType: mime_type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to storage", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        user_id: userId,
        folder_id: folder_id || null,
        name: file_name,
        original_name: file_name,
        mime_type: mime_type,
        size_bytes: bytes.length,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from("user-files").remove([storagePath]);
      
      return new Response(
        JSON.stringify({ error: "Failed to create file record", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`File uploaded successfully: ${fileRecord.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: fileRecord.id,
          name: fileRecord.name,
          size_bytes: fileRecord.size_bytes,
          mime_type: fileRecord.mime_type,
          created_at: fileRecord.created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Telegram upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

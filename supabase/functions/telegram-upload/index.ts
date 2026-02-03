import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFeatureEnabled, featureDisabledResponse } from "../_shared/feature-flags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// VPS Configuration - uses environment variables
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

interface TelegramUploadRequest {
  file_name: string;
  file_data: string; // Base64 encoded file data
  mime_type: string;
  folder_id?: string;
}

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for feature flag check
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check feature flag for telegram upload
    const telegramUploadEnabled = await isFeatureEnabled(supabaseAdmin, 'feature_telegram_upload');
    if (!telegramUploadEnabled) {
      return featureDisabledResponse('Telegram upload', corsHeaders);
    }
    
    // Get API token from header
    const apiToken = req.headers.get("x-api-key");
    
    if (!apiToken) {
      console.log("Missing API token");
      return new Response(
        JSON.stringify({ error: "Missing API token. Include x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token format (should be at least 32 chars for security)
    if (apiToken.length < 32) {
      console.log("Invalid API token format - too short");
      return new Response(
        JSON.stringify({ error: "Invalid API token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the provided token and look it up in the database
    const tokenHash = await hashToken(apiToken);
    
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("api_tokens")
      .select("id, user_id, is_active, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !tokenRecord) {
      console.log("Invalid API token - not found in database");
      return new Response(
        JSON.stringify({ error: "Invalid API token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is active
    if (!tokenRecord.is_active) {
      console.log("API token is deactivated");
      return new Response(
        JSON.stringify({ error: "API token has been deactivated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      console.log("API token has expired");
      return new Response(
        JSON.stringify({ error: "API token has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = tokenRecord.user_id;

    // Update last_used_at for the token (non-blocking)
    supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id)
      .then(() => console.log("Updated token last_used_at"));

    // Parse request body
    const body: TelegramUploadRequest = await req.json();
    const { file_name, file_data, mime_type, folder_id } = body;

    if (!file_name || !file_data || !mime_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_name, file_data, mime_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file_name (prevent path traversal)
    if (file_name.includes("..") || file_name.includes("/") || file_name.includes("\\")) {
      return new Response(
        JSON.stringify({ error: "Invalid file name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit file name length
    if (file_name.length > 255) {
      return new Response(
        JSON.stringify({ error: "File name too long (max 255 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📦 Processing Telegram upload for user ${userId}: ${file_name}`);

    // Decode base64 file data
    let bytes: Uint8Array;
    try {
      const binaryString = atob(file_data);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid base64 file data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit file size (50MB)
    const maxFileSize = 50 * 1024 * 1024;
    if (bytes.length > maxFileSize) {
      return new Response(
        JSON.stringify({ error: "File too large (max 50MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename for VPS storage
    const fileExt = file_name.split(".").pop()?.toLowerCase() || "bin";
    const storageName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `${userId}/${storageName}`;

    console.log(`📤 Uploading to VPS: ${VPS_ENDPOINT}`);

    // Convert file data to base64 using chunked approach (avoids stack overflow)
    const base64Data = uint8ArrayToBase64(bytes);

    // Upload to VPS storage
    const vpsResponse = await fetch(`${VPS_ENDPOINT}/upload-base64`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: storageName,
        originalName: file_name,
        mimeType: mime_type,
        data: base64Data,
        userId: userId,
      }),
    });

    if (!vpsResponse.ok) {
      const errorText = await vpsResponse.text();
      console.error(`VPS upload error: ${vpsResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to upload file to storage", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vpsResult = await vpsResponse.json();
    const finalStoragePath = vpsResult.path || storagePath;

    console.log(`✅ VPS upload successful: ${finalStoragePath}`);

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
        storage_path: finalStoragePath,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      
      // Try to clean up the uploaded file from VPS
      try {
        await fetch(`${VPS_ENDPOINT}/delete`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${VPS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            fileName: storageName,
          }),
        });
      } catch (cleanupError) {
        console.error("Failed to cleanup VPS file:", cleanupError);
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to create file record", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ File uploaded successfully: ${fileRecord.id}`);

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

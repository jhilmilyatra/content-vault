import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-callback-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// VPS callback secret for authentication
const VPS_CALLBACK_KEY = Deno.env.get("VPS_CALLBACK_KEY") || "vps-thumbnail-callback-secret";

interface ThumbnailUpdateRequest {
  storagePath: string;      // e.g., "user-id/filename.mp4"
  thumbnailUrl: string;     // Relative path to thumbnail
  posterUrl?: string;       // Relative path to poster (larger)
  animatedPreviewUrl?: string; // Relative path to GIF preview
  hlsPath?: string;         // Path to HLS directory
  qualities?: Array<{ name: string; resolution: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Authenticate callback from VPS
    const callbackKey = req.headers.get("x-vps-callback-key");
    const authHeader = req.headers.get("Authorization");
    
    // Accept either callback key or valid user token
    let isAuthorized = false;
    let userId: string | null = null;
    
    if (callbackKey === VPS_CALLBACK_KEY) {
      isAuthorized = true;
    } else if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (!error && user) {
        isAuthorized = true;
        userId = user.id;
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ThumbnailUpdateRequest = await req.json();
    const { storagePath, thumbnailUrl, posterUrl, animatedPreviewUrl, hlsPath, qualities } = body;

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "storagePath is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the file by storage_path
    const { data: files, error: findError } = await supabase
      .from("files")
      .select("id, user_id, storage_path, thumbnail_url, description")
      .eq("storage_path", storagePath)
      .limit(1);

    if (findError) {
      console.error("Error finding file:", findError);
      return new Response(
        JSON.stringify({ error: "Failed to find file", details: findError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!files || files.length === 0) {
      console.warn(`File not found for storage path: ${storagePath}`);
      return new Response(
        JSON.stringify({ error: "File not found", storagePath }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const file = files[0];

    // If userId is set (authenticated user request), verify ownership
    if (userId && file.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - not file owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the full thumbnail URL based on storage path
    // Storage path format: "userId/filename.ext"
    // HLS thumbnails are at: "userId/hls/baseName/baseName_thumb.jpg"
    const parts = storagePath.split('/');
    const fileUserId = parts[0];
    const fileName = parts.slice(1).join('/');
    const baseName = fileName.replace(/\.[^.]+$/, '');
    
    // Construct thumbnail URL relative to the VPS HLS path
    // Format: /hls/{userId}/{baseName}/{assetName}
    const fullThumbnailUrl = thumbnailUrl 
      ? `/hls/${fileUserId}/${baseName}/${thumbnailUrl}`
      : null;
    
    const fullPosterUrl = posterUrl
      ? `/hls/${fileUserId}/${baseName}/${posterUrl}`
      : null;
      
    const fullAnimatedUrl = animatedPreviewUrl
      ? `/hls/${fileUserId}/${baseName}/${animatedPreviewUrl}`
      : null;

    // Use the most appropriate thumbnail (poster > thumbnail)
    const primaryThumbnail = fullPosterUrl || fullThumbnailUrl;

    // Update the file record with thumbnail URL
    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update({
        thumbnail_url: primaryThumbnail,
        // Store additional metadata in description if needed
        description: file.description || (qualities 
          ? `HLS: ${qualities.map(q => q.name).join(', ')}`
          : null),
      })
      .eq("id", file.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating file:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update file", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Updated thumbnail for ${storagePath}: ${primaryThumbnail}`);

    return new Response(
      JSON.stringify({
        success: true,
        file: updatedFile,
        thumbnails: {
          thumbnail: fullThumbnailUrl,
          poster: fullPosterUrl,
          animatedPreview: fullAnimatedUrl,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Thumbnail update error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

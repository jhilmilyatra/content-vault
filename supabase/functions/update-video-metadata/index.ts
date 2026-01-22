import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateMetadataRequest {
  fileId: string;
  thumbnailUrl?: string | null;
  thumbnailDataUrl?: string | null; // Base64 data URL for inline thumbnail
  durationSeconds?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vpsEndpoint = Deno.env.get("VPS_ENDPOINT") || "http://46.38.232.46:4000";
    const vpsApiKey = Deno.env.get("VPS_API_KEY") || "kARTOOS007";

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

    const body: UpdateMetadataRequest = await req.json();
    const { fileId, thumbnailUrl, thumbnailDataUrl, durationSeconds } = body;

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "fileId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the file record to verify ownership
    const { data: file, error: fetchError } = await supabase
      .from("files")
      .select("id, user_id, storage_path, thumbnail_url")
      .eq("id", fileId)
      .single();

    if (fetchError || !file) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (file.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - not file owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalThumbnailUrl = thumbnailUrl;

    // If thumbnailDataUrl is provided, upload it to VPS storage
    if (thumbnailDataUrl && thumbnailDataUrl.startsWith('data:image')) {
      try {
        // Extract base64 data from data URL
        const base64Match = thumbnailDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (base64Match) {
          const base64Data = base64Match[1];
          
          // Generate thumbnail filename from storage path
          const storagePath = file.storage_path;
          const baseName = storagePath.replace(/\.[^.]+$/, '');
          const thumbnailFileName = `${baseName.split('/').pop()}_thumb.jpg`;

          // Upload thumbnail to VPS using base64 endpoint
          const vpsResponse = await fetch(`${vpsEndpoint}/upload-base64`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vpsApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: thumbnailFileName,
              originalName: thumbnailFileName,
              mimeType: "image/jpeg",
              data: base64Data,
              userId: user.id,
            }),
          });

          if (vpsResponse.ok) {
            const vpsResult = await vpsResponse.json();
            // Construct full thumbnail URL using VPS CDN if available
            const cdnUrl = Deno.env.get("VPS_CDN_URL");
            const thumbnailPath = vpsResult.path || `${user.id}/${thumbnailFileName}`;
            
            if (cdnUrl) {
              finalThumbnailUrl = `${cdnUrl}/files/${thumbnailPath}`;
            } else {
              finalThumbnailUrl = `${vpsEndpoint}/files/${thumbnailPath}`;
            }
            
            console.log(`✅ Thumbnail uploaded to VPS: ${finalThumbnailUrl}`);
          } else {
            const errorText = await vpsResponse.text();
            console.error("Failed to upload thumbnail to VPS:", errorText);
            // Don't store data URL in DB - it's too large
            finalThumbnailUrl = null;
          }
        }
      } catch (uploadError) {
        console.error("Thumbnail upload error:", uploadError);
        finalThumbnailUrl = null;
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    
    if (finalThumbnailUrl !== undefined) {
      updateData.thumbnail_url = finalThumbnailUrl;
    }

    // Store duration in dedicated column
    if (durationSeconds !== undefined && durationSeconds > 0) {
      updateData.duration_seconds = durationSeconds;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No updates needed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the file record
    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update(updateData)
      .eq("id", fileId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating file:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update file", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Updated video metadata for ${fileId}: thumbnail=${!!finalThumbnailUrl}, duration=${durationSeconds}s`);

    return new Response(
      JSON.stringify({
        success: true,
        file: updatedFile,
        thumbnailUrl: finalThumbnailUrl,
        durationSeconds,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Update video metadata error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Primary VPS storage - hardcoded
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

// Chunk size: 5MB
const CHUNK_SIZE = 5 * 1024 * 1024;

// Helper function to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "upload";

    // Initialize a new chunked upload
    if (action === "init") {
      const body = await req.json();
      const { fileName, mimeType, totalSize, totalChunks, folderId } = body;

      if (!fileName || !totalSize || !totalChunks) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      // Store session in database instead of in-memory Map
      const { error: insertError } = await supabase
        .from("chunked_upload_sessions")
        .insert({
          upload_id: uploadId,
          user_id: user.id,
          file_name: fileName,
          mime_type: mimeType || "application/octet-stream",
          total_size: totalSize,
          total_chunks: totalChunks,
          uploaded_chunks: [],
          folder_id: folderId || null,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to create upload session:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to initialize upload" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`📦 Initialized chunked upload: ${uploadId} for ${fileName} (${totalChunks} chunks)`);

      return new Response(
        JSON.stringify({
          uploadId,
          chunkSize: CHUNK_SIZE,
          totalChunks,
          expiresAt: expiresAt.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get upload status (for resume)
    if (action === "status") {
      const uploadId = url.searchParams.get("uploadId");
      
      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: "Upload ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session, error: fetchError } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", uploadId)
        .single();
      
      if (fetchError || !session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          uploadId: session.upload_id,
          fileName: session.file_name,
          totalChunks: session.total_chunks,
          uploadedChunks: session.uploaded_chunks || [],
          progress: ((session.uploaded_chunks?.length || 0) / session.total_chunks) * 100,
          expiresAt: session.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload a chunk
    if (action === "chunk") {
      const formData = await req.formData();
      const chunk = formData.get("chunk") as File;
      const uploadId = formData.get("uploadId") as string;
      const chunkIndex = parseInt(formData.get("chunkIndex") as string);

      if (!chunk || !uploadId || isNaN(chunkIndex)) {
        return new Response(
          JSON.stringify({ error: "Missing chunk data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session, error: fetchError } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", uploadId)
        .single();
      
      if (fetchError || !session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadedChunks: number[] = session.uploaded_chunks || [];

      // Check if chunk already uploaded
      if (uploadedChunks.includes(chunkIndex)) {
        console.log(`⏭️ Chunk ${chunkIndex} already uploaded, skipping`);
        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            skipped: true,
            progress: (uploadedChunks.length / session.total_chunks) * 100,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upload chunk to VPS
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      const base64Data = uint8ArrayToBase64(chunkData);

      const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;
      
      const vpsResponse = await fetch(`${VPS_ENDPOINT}/upload-base64`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: chunkFileName,
          originalName: chunkFileName,
          mimeType: "application/octet-stream",
          data: base64Data,
          userId: user.id,
        }),
      });

      if (!vpsResponse.ok) {
        const errorText = await vpsResponse.text();
        console.error(`VPS chunk upload failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to upload chunk" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ATOMIC UPDATE: Use raw SQL to append to array atomically
      // This prevents race conditions when multiple chunks are uploaded in parallel
      const { data: updatedSession, error: updateError } = await supabase.rpc('append_chunk_to_session', {
        p_upload_id: uploadId,
        p_chunk_index: chunkIndex
      }).single();

      // Fallback to regular update if RPC doesn't exist
      let finalUploadedChunks: number[];
      if (updateError) {
        // RPC might not exist, use regular update with retry logic
        console.log(`RPC not available, using regular update for chunk ${chunkIndex}`);
        
        // Re-fetch current state and update
        const { data: currentSession } = await supabase
          .from("chunked_upload_sessions")
          .select("uploaded_chunks")
          .eq("upload_id", uploadId)
          .single();
        
        const currentChunks: number[] = currentSession?.uploaded_chunks || [];
        if (!currentChunks.includes(chunkIndex)) {
          const newChunks = [...currentChunks, chunkIndex].sort((a, b) => a - b);
          
          await supabase
            .from("chunked_upload_sessions")
            .update({ uploaded_chunks: newChunks })
            .eq("upload_id", uploadId);
          
          finalUploadedChunks = newChunks;
        } else {
          finalUploadedChunks = currentChunks;
        }
      } else {
        // Get updated chunks count from RPC result
        const { data: refreshedSession } = await supabase
          .from("chunked_upload_sessions")
          .select("uploaded_chunks")
          .eq("upload_id", uploadId)
          .single();
        
        finalUploadedChunks = refreshedSession?.uploaded_chunks || [];
      }

      const progress = (finalUploadedChunks.length / session.total_chunks) * 100;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%)`);

      return new Response(
        JSON.stringify({
          success: true,
          chunkIndex,
          uploadedChunks: finalUploadedChunks.length,
          totalChunks: session.total_chunks,
          progress,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Finalize and assemble the file
    if (action === "finalize") {
      const body = await req.json();
      const { uploadId } = body;

      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: "Upload ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session, error: fetchError } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", uploadId)
        .single();
      
      if (fetchError || !session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadedChunks: number[] = session.uploaded_chunks || [];

      // Check all chunks are uploaded
      if (uploadedChunks.length !== session.total_chunks) {
        return new Response(
          JSON.stringify({ 
            error: "Not all chunks uploaded",
            uploadedChunks: uploadedChunks.length,
            totalChunks: session.total_chunks,
            missingChunks: Array.from({ length: session.total_chunks }, (_, i) => i)
              .filter(i => !uploadedChunks.includes(i))
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🔧 Assembling ${session.total_chunks} chunks for ${session.file_name}...`);

      // Fetch and combine all chunks
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      for (let i = 0; i < session.total_chunks; i++) {
        const chunkFileName = `${uploadId}_chunk_${i}`;
        
        const vpsResponse = await fetch(`${VPS_ENDPOINT}/files/${user.id}/${chunkFileName}`, {
          headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
        });

        if (!vpsResponse.ok) {
          console.error(`Failed to fetch chunk ${i}`);
          return new Response(
            JSON.stringify({ error: `Failed to retrieve chunk ${i}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const chunkData = new Uint8Array(await vpsResponse.arrayBuffer());
        chunks.push(chunkData);
        totalBytes += chunkData.length;
      }

      // Combine chunks
      const combinedData = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      console.log(`📦 Combined file size: ${totalBytes} bytes`);

      // Upload final combined file
      const base64Data = uint8ArrayToBase64(combinedData);
      const timestamp = Date.now().toString(16).padStart(16, '0');
      const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const ext = session.file_name.split('.').pop() || '';
      const storageName = `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;

      const vpsResponse = await fetch(`${VPS_ENDPOINT}/upload-base64`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: storageName,
          originalName: session.file_name,
          mimeType: session.mime_type,
          data: base64Data,
          userId: user.id,
        }),
      });

      if (!vpsResponse.ok) {
        const errorText = await vpsResponse.text();
        console.error(`VPS final upload failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to upload final file" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vpsResult = await vpsResponse.json();
      const storagePath = vpsResult.path;

      // Create file record in database
      const { data: fileRecord, error: dbError } = await supabase
        .from("files")
        .insert({
          user_id: user.id,
          folder_id: session.folder_id,
          name: session.file_name,
          original_name: session.file_name,
          mime_type: session.mime_type,
          size_bytes: totalBytes,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        console.error(`Database error: ${dbError.message}`);
        return new Response(
          JSON.stringify({ error: "Failed to create file record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clean up chunks and session (fire and forget)
      const cleanupChunks = async () => {
        for (let i = 0; i < session.total_chunks; i++) {
          const chunkFileName = `${uploadId}_chunk_${i}`;
          try {
            await fetch(`${VPS_ENDPOINT}/delete`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${VPS_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ path: `${user.id}/${chunkFileName}` }),
            });
          } catch (e) {
            console.error(`Failed to delete chunk ${i}:`, e);
          }
        }
        
        // Delete session from database
        await supabase
          .from("chunked_upload_sessions")
          .delete()
          .eq("upload_id", uploadId);
          
        console.log(`🧹 Cleaned up ${session.total_chunks} chunks for upload ${uploadId}`);
      };
      
      // Start cleanup in background
      cleanupChunks().catch(console.error);

      console.log(`✅ Chunked upload complete: ${session.file_name}`);

      return new Response(
        JSON.stringify({
          success: true,
          file: fileRecord,
          storageType: "vps",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Chunked upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

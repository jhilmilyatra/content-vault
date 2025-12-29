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

// Type definitions for RPC results
interface UploadProgress {
  uploaded_count: number;
  total_chunks: number;
  progress: number;
  is_complete: boolean;
  uploaded_indices: number[];
}

interface ChunkRecordResult {
  success: boolean;
  uploaded_count: number;
  total_chunks: number;
  progress: number;
  is_complete: boolean;
}

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

      // Store session in database (uploaded_chunks array kept for backward compat but not used)
      const { error: insertError } = await supabase
        .from("chunked_upload_sessions")
        .insert({
          upload_id: uploadId,
          user_id: user.id,
          file_name: fileName,
          mime_type: mimeType || "application/octet-stream",
          total_size: totalSize,
          total_chunks: totalChunks,
          uploaded_chunks: [], // Legacy, not used anymore
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

    // Get upload status (for resume) - NOW USES DATABASE-DERIVED PROGRESS
    if (action === "status") {
      const uploadId = url.searchParams.get("uploadId");
      
      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: "Upload ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify session exists and user owns it
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

      // Get accurate progress from normalized table
      const { data: progressDataRaw, error: progressError } = await supabase
        .rpc('get_upload_progress', { p_upload_id: uploadId })
        .single();
      
      const progressData = progressDataRaw as UploadProgress | null;

      if (progressError) {
        console.error("Failed to get progress:", progressError);
        // Fallback to legacy array
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

      return new Response(
        JSON.stringify({
          uploadId: session.upload_id,
          fileName: session.file_name,
          totalChunks: progressData?.total_chunks || session.total_chunks,
          uploadedChunks: progressData?.uploaded_indices || [],
          uploadedCount: progressData?.uploaded_count || 0,
          progress: progressData?.progress || 0,
          isComplete: progressData?.is_complete || false,
          expiresAt: session.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload a chunk - NOW USES ATOMIC INSERT
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

      // Check if chunk already uploaded (idempotent check)
      const { data: existingChunk } = await supabase
        .from("upload_chunks")
        .select("chunk_index")
        .eq("upload_id", uploadId)
        .eq("chunk_index", chunkIndex)
        .maybeSingle();

      if (existingChunk) {
        console.log(`⏭️ Chunk ${chunkIndex} already uploaded, skipping`);
        
        // Get current progress
        const { data: skipProgressRaw } = await supabase
          .rpc('get_upload_progress', { p_upload_id: uploadId })
          .single();
        const skipProgress = skipProgressRaw as UploadProgress | null;
        
        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            skipped: true,
            uploadedChunks: skipProgress?.uploaded_count || 0,
            totalChunks: session.total_chunks,
            progress: skipProgress?.progress || 0,
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

      // ATOMIC INSERT: Use RPC for race-condition-free chunk recording
      const { data: recordResultRaw, error: recordError } = await supabase
        .rpc('record_chunk_upload', { 
          p_upload_id: uploadId, 
          p_chunk_index: chunkIndex 
        })
        .single();
      
      const recordResult = recordResultRaw as ChunkRecordResult | null;

      if (recordError) {
        console.error(`Failed to record chunk: ${recordError.message}`);
        // Fallback: Direct atomic insert with ON CONFLICT DO NOTHING
        const { error: directInsertError } = await supabase
          .from("upload_chunks")
          .insert({ upload_id: uploadId, chunk_index: chunkIndex })
          .select()
          .maybeSingle();

        if (directInsertError && !directInsertError.message.includes('duplicate')) {
          console.error(`Direct insert also failed: ${directInsertError.message}`);
        }

        // Get progress after insert
        const { data: fallbackProgressRaw } = await supabase
          .rpc('get_upload_progress', { p_upload_id: uploadId })
          .single();
        const fallbackProgress = fallbackProgressRaw as UploadProgress | null;

        const progress = fallbackProgress?.progress || 0;
        console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%) [fallback]`);

        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            uploadedChunks: fallbackProgress?.uploaded_count || 0,
            totalChunks: session.total_chunks,
            progress,
            isComplete: fallbackProgress?.is_complete || false,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const progress = recordResult?.progress || 0;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%)`);

      return new Response(
        JSON.stringify({
          success: true,
          chunkIndex,
          uploadedChunks: recordResult?.uploaded_count || 0,
          totalChunks: recordResult?.total_chunks || session.total_chunks,
          progress,
          isComplete: recordResult?.is_complete || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Finalize and assemble the file - NOW USES DATABASE-DERIVED COMPLETION CHECK
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

      // Get accurate progress from normalized table (database-derived, always accurate)
      const { data: finalProgressRaw, error: progressError } = await supabase
        .rpc('get_upload_progress', { p_upload_id: uploadId })
        .single();
      
      const finalProgress = finalProgressRaw as UploadProgress | null;

      if (progressError) {
        console.error("Failed to get progress for finalization:", progressError);
        return new Response(
          JSON.stringify({ error: "Failed to verify upload completion" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadedCount = finalProgress?.uploaded_count || 0;
      const totalChunks = finalProgress?.total_chunks || session.total_chunks;
      const uploadedIndices: number[] = finalProgress?.uploaded_indices || [];

      // Check all chunks are uploaded (database-derived, no race conditions)
      if (uploadedCount !== totalChunks) {
        const missingChunks = Array.from({ length: totalChunks }, (_, i) => i)
          .filter(i => !uploadedIndices.includes(i));
        
        console.log(`❌ Finalization failed: ${uploadedCount}/${totalChunks} chunks uploaded. Missing: ${missingChunks.join(', ')}`);
        
        return new Response(
          JSON.stringify({ 
            error: "Not all chunks uploaded",
            uploadedChunks: uploadedCount,
            totalChunks: totalChunks,
            missingChunks: missingChunks
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🔧 Assembling ${totalChunks} chunks for ${session.file_name}...`);

      // Helper function to fetch chunk with retries
      const fetchChunkWithRetry = async (chunkIndex: number, maxRetries = 3): Promise<Uint8Array> => {
        const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const vpsResponse = await fetch(`${VPS_ENDPOINT}/files/${user.id}/${chunkFileName}`, {
              headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
            });

            if (vpsResponse.ok) {
              const chunkData = new Uint8Array(await vpsResponse.arrayBuffer());
              if (attempt > 1) {
                console.log(`✅ Chunk ${chunkIndex} retrieved on attempt ${attempt}`);
              }
              return chunkData;
            }
            
            const statusText = vpsResponse.status;
            lastError = new Error(`VPS returned ${statusText}`);
            console.warn(`⚠️ Chunk ${chunkIndex} fetch attempt ${attempt}/${maxRetries} failed: ${statusText}`);
            
            if (attempt < maxRetries) {
              // Exponential backoff: 1s, 2s, 4s
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            console.warn(`⚠️ Chunk ${chunkIndex} fetch attempt ${attempt}/${maxRetries} error: ${lastError.message}`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
          }
        }
        
        throw new Error(`Failed to retrieve chunk ${chunkIndex} after ${maxRetries} attempts: ${lastError?.message}`);
      };

      // Fetch and combine all chunks with retry logic
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const failedChunks: number[] = [];

      for (let i = 0; i < totalChunks; i++) {
        try {
          const chunkData = await fetchChunkWithRetry(i);
          chunks.push(chunkData);
          totalBytes += chunkData.length;
          
          if (i % 10 === 0) {
            console.log(`📦 Fetched ${i + 1}/${totalChunks} chunks...`);
          }
        } catch (e) {
          console.error(`❌ Failed to fetch chunk ${i}: ${e instanceof Error ? e.message : e}`);
          failedChunks.push(i);
        }
      }

      // If any chunks failed, return detailed error
      if (failedChunks.length > 0) {
        console.error(`❌ ${failedChunks.length} chunks failed to retrieve: ${failedChunks.join(', ')}`);
        return new Response(
          JSON.stringify({ 
            error: `Failed to retrieve ${failedChunks.length} chunk(s)`,
            failedChunks: failedChunks,
            message: "Some chunks could not be retrieved from storage. The upload may need to be retried."
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        for (let i = 0; i < totalChunks; i++) {
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
        
        // Delete session from database (this will cascade-delete upload_chunks via trigger)
        await supabase
          .from("chunked_upload_sessions")
          .delete()
          .eq("upload_id", uploadId);
          
        console.log(`🧹 Cleaned up ${totalChunks} chunks for upload ${uploadId}`);
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

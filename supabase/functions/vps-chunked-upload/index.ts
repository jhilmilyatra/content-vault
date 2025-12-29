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

    // Initialize a new chunked upload - generates unique storage filename
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
      
      // Generate the final storage filename upfront (used for direct append)
      const timestamp = Date.now().toString(16).padStart(16, '0');
      const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const ext = fileName.split('.').pop() || '';
      const storageFileName = `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;

      // Store session in database with storage filename
      const { error: insertError } = await supabase
        .from("chunked_upload_sessions")
        .insert({
          upload_id: uploadId,
          user_id: user.id,
          file_name: fileName,
          mime_type: mimeType || "application/octet-stream",
          total_size: totalSize,
          total_chunks: totalChunks,
          uploaded_chunks: [], // Legacy field, not used
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

      console.log(`📦 Initialized chunked upload: ${uploadId} for ${fileName} -> ${storageFileName} (${totalChunks} chunks)`);

      return new Response(
        JSON.stringify({
          uploadId,
          storageFileName, // Send back for client to use
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

      // Get accurate progress from normalized table
      const { data: progressDataRaw, error: progressError } = await supabase
        .rpc('get_upload_progress', { p_upload_id: uploadId })
        .single();
      
      const progressData = progressDataRaw as UploadProgress | null;

      if (progressError) {
        console.error("Failed to get progress:", progressError);
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

    // Upload a chunk - NOW APPENDS DIRECTLY TO FINAL FILE
    if (action === "chunk") {
      const formData = await req.formData();
      const chunk = formData.get("chunk") as File;
      const uploadId = formData.get("uploadId") as string;
      const chunkIndex = parseInt(formData.get("chunkIndex") as string);
      const storageFileName = formData.get("storageFileName") as string;

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
        console.log(`⏭️ Chunk ${chunkIndex} already uploaded, skipping VPS upload`);
        
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

      // DIRECT APPEND: Upload chunk directly to final file using chunk-append endpoint
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      const base64Data = uint8ArrayToBase64(chunkData);

      // Use provided storageFileName or generate one
      const finalFileName = storageFileName || (() => {
        const timestamp = Date.now().toString(16).padStart(16, '0');
        const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const ext = session.file_name.split('.').pop() || '';
        return `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;
      })();
      
      const isFirstChunk = chunkIndex === 0;
      const isLastChunk = chunkIndex === session.total_chunks - 1;

      const vpsResponse = await fetch(`${VPS_ENDPOINT}/chunk-append`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: finalFileName,
          data: base64Data,
          userId: user.id,
          chunkIndex,
          totalChunks: session.total_chunks,
          isFirstChunk,
          isLastChunk,
        }),
      });

      if (!vpsResponse.ok) {
        const errorText = await vpsResponse.text();
        console.error(`VPS chunk append failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to upload chunk", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vpsResult = await vpsResponse.json();

      // Record chunk in database using atomic RPC
      const { data: recordResultRaw, error: recordError } = await supabase
        .rpc('record_chunk_upload', { 
          p_upload_id: uploadId, 
          p_chunk_index: chunkIndex 
        })
        .single();
      
      const recordResult = recordResultRaw as ChunkRecordResult | null;

      if (recordError) {
        console.error(`Failed to record chunk: ${recordError.message}`);
        // Fallback: Direct insert
        await supabase
          .from("upload_chunks")
          .insert({ upload_id: uploadId, chunk_index: chunkIndex })
          .select()
          .maybeSingle();

        const { data: fallbackProgressRaw } = await supabase
          .rpc('get_upload_progress', { p_upload_id: uploadId })
          .single();
        const fallbackProgress = fallbackProgressRaw as UploadProgress | null;

        const progress = fallbackProgress?.progress || 0;
        console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} appended (${progress.toFixed(1)}%) [fallback]`);

        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            uploadedChunks: fallbackProgress?.uploaded_count || 0,
            totalChunks: session.total_chunks,
            progress,
            isComplete: fallbackProgress?.is_complete || false,
            currentFileSize: vpsResult.currentSize,
            storageFileName: finalFileName,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const progress = recordResult?.progress || 0;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} appended directly (${progress.toFixed(1)}%)`);

      return new Response(
        JSON.stringify({
          success: true,
          chunkIndex,
          uploadedChunks: recordResult?.uploaded_count || 0,
          totalChunks: recordResult?.total_chunks || session.total_chunks,
          progress,
          isComplete: recordResult?.is_complete || false,
          currentFileSize: vpsResult.currentSize,
          storageFileName: finalFileName,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Finalize - NOW JUST VERIFIES AND CREATES DB RECORD (no chunk retrieval needed!)
    if (action === "finalize") {
      const body = await req.json();
      const { uploadId, storageFileName } = body;

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

      // Get progress from database
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

      // Check all chunks are recorded
      if (uploadedCount !== totalChunks) {
        const missingChunks = Array.from({ length: totalChunks }, (_, i) => i)
          .filter(i => !uploadedIndices.includes(i));
        
        console.log(`❌ Finalization failed: ${uploadedCount}/${totalChunks} chunks recorded. Missing: ${missingChunks.join(', ')}`);
        
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

      console.log(`🔧 Verifying file ${storageFileName} on VPS...`);

      // Verify the file exists and has correct size on VPS
      const verifyResponse = await fetch(`${VPS_ENDPOINT}/verify-file`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: storageFileName,
          userId: user.id,
          expectedSize: session.total_size,
        }),
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error(`VPS verification failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "File verification failed on storage server" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const verifyResult = await verifyResponse.json();
      
      if (!verifyResult.exists) {
        console.error(`❌ File not found on VPS: ${storageFileName}`);
        return new Response(
          JSON.stringify({ error: "File not found on storage server" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // File exists on VPS - create database record
      const storagePath = `${user.id}/${storageFileName}`;

      const { data: fileRecord, error: dbError } = await supabase
        .from("files")
        .insert({
          user_id: user.id,
          folder_id: session.folder_id,
          name: session.file_name,
          original_name: session.file_name,
          mime_type: session.mime_type,
          size_bytes: verifyResult.size || session.total_size,
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

      // Clean up session (fire and forget)
      const cleanup = async () => {
        // Delete upload_chunks records
        await supabase
          .from("upload_chunks")
          .delete()
          .eq("upload_id", uploadId);
          
        // Delete session
        await supabase
          .from("chunked_upload_sessions")
          .delete()
          .eq("upload_id", uploadId);
          
        console.log(`🧹 Cleaned up session for upload ${uploadId}`);
      };
      
      cleanup().catch(console.error);

      console.log(`✅ Chunked upload complete: ${session.file_name} (${verifyResult.size} bytes)`);

      return new Response(
        JSON.stringify({
          success: true,
          file: fileRecord,
          storageType: "vps",
          fileSize: verifyResult.size,
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

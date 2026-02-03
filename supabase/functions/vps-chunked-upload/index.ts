import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Primary VPS storage - from environment variables
const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

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
      
      // Generate the final storage filename upfront
      const timestamp = Date.now().toString(16).padStart(16, '0');
      const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const ext = fileName.split('.').pop() || '';
      const storageFileName = `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;

      // Store session in database
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

      console.log(`📦 Initialized chunked upload: ${uploadId} for ${fileName} -> ${storageFileName} (${totalChunks} chunks)`);

      return new Response(
        JSON.stringify({
          uploadId,
          storageFileName,
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

    // Upload a chunk - uses direct append for speed
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
        console.log(`⏭️ Chunk ${chunkIndex} already uploaded, skipping`);
        
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

      // Determine the filename to use
      const finalFileName = storageFileName || (() => {
        const timestamp = Date.now().toString(16).padStart(16, '0');
        const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const ext = session.file_name.split('.').pop() || '';
        return `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;
      })();

      // Try direct append first, fallback to temp storage if endpoint not available
      const chunkData = new Uint8Array(await chunk.arrayBuffer());
      const base64Data = uint8ArrayToBase64(chunkData);
      
      const isFirstChunk = chunkIndex === 0;
      const isLastChunk = chunkIndex === session.total_chunks - 1;

      // Try direct append endpoint
      let useDirectAppend = true;
      try {
        const appendResponse = await fetch(`${VPS_ENDPOINT}/chunk-append`, {
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

        if (!appendResponse.ok) {
          const errorText = await appendResponse.text();
          // Check if it's a 404 (endpoint not available) - fallback to temp storage
          if (appendResponse.status === 404 || errorText.includes("Cannot POST")) {
            console.log(`⚠️ Direct append not available, falling back to temp storage`);
            useDirectAppend = false;
          } else {
            console.error(`VPS chunk append failed: ${errorText}`);
            return new Response(
              JSON.stringify({ error: "Failed to upload chunk", details: errorText }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.log(`⚠️ Direct append error, falling back to temp storage: ${e}`);
        useDirectAppend = false;
      }

      // Fallback: Upload as temporary chunk file
      if (!useDirectAppend) {
        const chunkFileName = `${uploadId}_chunk_${chunkIndex.toString().padStart(5, '0')}`;
        
        const vpsFormData = new FormData();
        vpsFormData.append("file", chunk, chunkFileName);
        vpsFormData.append("userId", user.id);
        vpsFormData.append("path", `chunks/${uploadId}`);

        const vpsResponse = await fetch(`${VPS_ENDPOINT}/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VPS_API_KEY}`,
          },
          body: vpsFormData,
        });

        if (!vpsResponse.ok) {
          const errorText = await vpsResponse.text();
          console.error(`VPS chunk upload failed: ${errorText}`);
          return new Response(
            JSON.stringify({ error: "Failed to upload chunk to storage", details: errorText }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

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
        console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%) [fallback]`);

        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            uploadedChunks: fallbackProgress?.uploaded_count || 0,
            totalChunks: session.total_chunks,
            progress,
            isComplete: fallbackProgress?.is_complete || false,
            storageFileName: finalFileName,
            useDirectAppend,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const progress = recordResult?.progress || 0;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%)${useDirectAppend ? ' [direct]' : ' [temp]'}`);

      return new Response(
        JSON.stringify({
          success: true,
          chunkIndex,
          uploadedChunks: recordResult?.uploaded_count || 0,
          totalChunks: recordResult?.total_chunks || session.total_chunks,
          progress,
          isComplete: recordResult?.is_complete || false,
          storageFileName: finalFileName,
          useDirectAppend,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Finalize - verifies file or assembles chunks
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

      // Generate final filename if not provided
      const finalFileName = storageFileName || (() => {
        const timestamp = Date.now().toString(16).padStart(16, '0');
        const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const ext = session.file_name.split('.').pop() || '';
        return `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;
      })();

      console.log(`🔧 Verifying file ${finalFileName} on VPS...`);

      // First try to verify if file exists (direct append mode)
      let fileExists = false;
      let actualSize = 0;
      
      try {
        const verifyResponse = await fetch(`${VPS_ENDPOINT}/verify-file`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${VPS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: finalFileName,
            userId: user.id,
            expectedSize: session.total_size,
          }),
        });

        if (verifyResponse.ok) {
          const verifyResult = await verifyResponse.json();
          fileExists = verifyResult.exists;
          actualSize = verifyResult.size || 0;
          console.log(`📁 File verification: exists=${fileExists}, size=${actualSize}, expected=${session.total_size}`);
        }
      } catch (e) {
        console.log(`⚠️ Verify endpoint not available: ${e}`);
      }

      // If file doesn't exist or size mismatch, try to assemble from chunks
      if (!fileExists || actualSize < session.total_size * 0.9) {
        console.log(`🔧 Assembling ${totalChunks} chunks into final file...`);

        // Retrieve and combine all chunks from VPS temp storage
        const chunkBuffers: Uint8Array[] = [];
        const failedChunks: number[] = [];

        for (let i = 0; i < totalChunks; i++) {
          const chunkFileName = `${uploadId}_chunk_${i.toString().padStart(5, '0')}`;
          const chunkPath = `chunks/${uploadId}/${chunkFileName}`;
          
          let chunkData: Uint8Array | null = null;
          let lastError = '';
          
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const chunkResponse = await fetch(
                `${VPS_ENDPOINT}/files/${user.id}/${chunkPath}`,
                {
                  headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
                }
              );

              if (chunkResponse.ok) {
                chunkData = new Uint8Array(await chunkResponse.arrayBuffer());
                break;
              } else {
                lastError = `HTTP ${chunkResponse.status}`;
                if (attempt < 2) {
                  await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
              }
            } catch (e) {
              lastError = e instanceof Error ? e.message : 'Unknown error';
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
              }
            }
          }
          
          if (chunkData) {
            chunkBuffers.push(chunkData);
          } else {
            console.error(`Failed to retrieve chunk ${i} after 3 attempts: ${lastError}`);
            failedChunks.push(i);
          }
        }

        // If chunks couldn't be retrieved and file doesn't exist, report error
        if (failedChunks.length > 0 && !fileExists) {
          console.error(`❌ Failed to retrieve ${failedChunks.length} chunks and file doesn't exist`);
          return new Response(
            JSON.stringify({ 
              error: "Some chunks could not be retrieved from storage",
              failedChunks,
              totalChunks
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If we got all chunks, combine and upload
        if (failedChunks.length === 0 && chunkBuffers.length === totalChunks) {
          const totalSize = chunkBuffers.reduce((sum, buf) => sum + buf.length, 0);
          const combinedData = new Uint8Array(totalSize);
          let offset = 0;
          for (const chunkBuf of chunkBuffers) {
            combinedData.set(chunkBuf, offset);
            offset += chunkBuf.length;
          }

          console.log(`📦 Combined ${totalChunks} chunks into ${totalSize} bytes`);

          // Upload final combined file
          const finalFormData = new FormData();
          finalFormData.append("file", new Blob([combinedData]), finalFileName);
          finalFormData.append("userId", user.id);

          const uploadResponse = await fetch(`${VPS_ENDPOINT}/upload`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${VPS_API_KEY}`,
            },
            body: finalFormData,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`Failed to upload final file: ${errorText}`);
            return new Response(
              JSON.stringify({ error: "Failed to upload final file" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Clean up temp chunks
          try {
            await fetch(`${VPS_ENDPOINT}/delete-folder`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${VPS_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: user.id,
                path: `chunks/${uploadId}`,
              }),
            });
            console.log(`🧹 Cleaned up temporary chunks`);
          } catch (e) {
            console.warn("Failed to cleanup chunks:", e);
          }
        }
      }

      const storagePath = `${user.id}/${finalFileName}`;

      // Create database record
      const { data: fileRecord, error: dbError } = await supabase
        .from("files")
        .insert({
          user_id: user.id,
          folder_id: session.folder_id,
          name: session.file_name,
          original_name: session.file_name,
          mime_type: session.mime_type,
          size_bytes: session.total_size,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Failed to create file record:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to save file record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete upload session
      await supabase
        .from("chunked_upload_sessions")
        .delete()
        .eq("upload_id", uploadId);

      console.log(`✅ Finalized upload: ${session.file_name} -> ${storagePath}`);

      return new Response(
        JSON.stringify({
          success: true,
          file: fileRecord,
          storagePath,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Chunked upload error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

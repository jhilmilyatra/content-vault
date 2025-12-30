import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Primary VPS storage - hardcoded
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

// Chunk size: 5MB (matches main chunked upload)
const CHUNK_SIZE = 5 * 1024 * 1024;

// Type definitions
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

interface TelegramUploadSession {
  upload_id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  total_size: number;
  total_chunks: number;
  folder_id: string | null;
  storage_file_name: string;
}

// In-memory session store (for edge function - consider using DB for persistence)
const uploadSessions = new Map<string, TelegramUploadSession>();

async function validateApiToken(supabase: any, apiToken: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!apiToken || apiToken.length < 32) {
    return null;
  }

  const tokenHash = await hashToken(apiToken);
  
  const { data: tokenRecord, error: tokenError } = await supabase
    .from("api_tokens")
    .select("id, user_id, is_active, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (tokenError || !tokenRecord) {
    return null;
  }

  if (!tokenRecord.is_active) {
    return null;
  }

  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
    return null;
  }

  return { userId: tokenRecord.user_id, tokenId: tokenRecord.id };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get API token from header
    const apiToken = req.headers.get("x-api-key");
    
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Missing API token. Include x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authResult = await validateApiToken(supabase, apiToken);
    if (!authResult) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired API token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, tokenId } = authResult;

    // Update last_used_at (non-blocking)
    supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId)
      .then(() => {});

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "init";

    // ==================== INIT ====================
    if (action === "init") {
      const body = await req.json();
      const { file_name, mime_type, total_size, folder_id } = body;

      if (!file_name || !total_size) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: file_name, total_size" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate file_name
      if (file_name.includes("..") || file_name.includes("/") || file_name.includes("\\")) {
        return new Response(
          JSON.stringify({ error: "Invalid file name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Limit file size (500MB for chunked uploads)
      const maxFileSize = 500 * 1024 * 1024;
      if (total_size > maxFileSize) {
        return new Response(
          JSON.stringify({ error: "File too large (max 500MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate folder if provided
      if (folder_id) {
        const { data: folder } = await supabase
          .from("folders")
          .select("id")
          .eq("id", folder_id)
          .eq("user_id", userId)
          .single();

        if (!folder) {
          return new Response(
            JSON.stringify({ error: "Folder not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const uploadId = crypto.randomUUID();
      const totalChunks = Math.ceil(total_size / CHUNK_SIZE);
      
      // Generate storage filename
      const fileExt = file_name.split(".").pop()?.toLowerCase() || "bin";
      const storageFileName = `${crypto.randomUUID()}.${fileExt}`;

      // Store session in database for persistence
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const { error: insertError } = await supabase
        .from("chunked_upload_sessions")
        .insert({
          upload_id: uploadId,
          user_id: userId,
          file_name: file_name,
          mime_type: mime_type || "application/octet-stream",
          total_size: total_size,
          total_chunks: totalChunks,
          uploaded_chunks: [],
          folder_id: folder_id || null,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to create upload session:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to initialize upload" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store in memory for quick access
      uploadSessions.set(uploadId, {
        upload_id: uploadId,
        user_id: userId,
        file_name,
        mime_type: mime_type || "application/octet-stream",
        total_size,
        total_chunks: totalChunks,
        folder_id: folder_id || null,
        storage_file_name: storageFileName,
      });

      console.log(`📦 Initialized Telegram chunked upload: ${uploadId} for ${file_name} (${totalChunks} chunks)`);

      return new Response(
        JSON.stringify({
          success: true,
          upload_id: uploadId,
          total_chunks: totalChunks,
          chunk_size: CHUNK_SIZE,
          storage_file_name: storageFileName,
          expires_at: expiresAt.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== CHUNK ====================
    if (action === "chunk") {
      const body = await req.json();
      const { upload_id, chunk_index, chunk_data, storage_file_name } = body;

      if (!upload_id || chunk_index === undefined || !chunk_data) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: upload_id, chunk_index, chunk_data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get session from database
      const { data: session, error: sessionError } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", upload_id)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if chunk already uploaded
      const { data: existingChunk } = await supabase
        .from("upload_chunks")
        .select("chunk_index")
        .eq("upload_id", upload_id)
        .eq("chunk_index", chunk_index)
        .maybeSingle();

      if (existingChunk) {
        console.log(`⏭️ Chunk ${chunk_index} already uploaded, skipping`);
        
        const { data: progressDataRaw } = await supabase
          .rpc('get_upload_progress', { p_upload_id: upload_id })
          .single();
        
        const progressData = progressDataRaw as UploadProgress | null;
        
        return new Response(
          JSON.stringify({
            success: true,
            chunk_index,
            skipped: true,
            uploaded_chunks: progressData?.uploaded_count || 0,
            total_chunks: session.total_chunks,
            progress: progressData?.progress || 0,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Decode base64 chunk data
      let chunkBytes: Uint8Array;
      try {
        const binaryString = atob(chunk_data);
        chunkBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          chunkBytes[i] = binaryString.charCodeAt(i);
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "Invalid base64 chunk data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalFileName = storage_file_name || `${upload_id}_file`;
      const isFirstChunk = chunk_index === 0;
      const isLastChunk = chunk_index === session.total_chunks - 1;

      // Upload chunk to VPS using direct append
      const base64Data = uint8ArrayToBase64(chunkBytes);
      
      const vpsResponse = await fetch(`${VPS_ENDPOINT}/chunk-append`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: finalFileName,
          data: base64Data,
          userId: userId,
          chunkIndex: chunk_index,
          totalChunks: session.total_chunks,
          isFirstChunk,
          isLastChunk,
        }),
      });

      if (!vpsResponse.ok) {
        const errorText = await vpsResponse.text();
        console.error(`VPS chunk upload failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to upload chunk", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record chunk in database
      const { data: recordResultRaw, error: recordError } = await supabase
        .rpc('record_chunk_upload', { 
          p_upload_id: upload_id, 
          p_chunk_index: chunk_index 
        })
        .single();
      
      const recordResult = recordResultRaw as ChunkRecordResult | null;

      if (recordError) {
        console.error(`Failed to record chunk: ${recordError.message}`);
        // Fallback: Direct insert
        await supabase
          .from("upload_chunks")
          .insert({ upload_id, chunk_index })
          .select()
          .maybeSingle();
      }

      const progress = recordResult?.progress || 0;
      console.log(`✅ Telegram chunk ${chunk_index + 1}/${session.total_chunks} uploaded (${progress.toFixed(1)}%)`);

      return new Response(
        JSON.stringify({
          success: true,
          chunk_index,
          uploaded_chunks: recordResult?.uploaded_count || 0,
          total_chunks: session.total_chunks,
          progress,
          is_complete: recordResult?.is_complete || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== FINALIZE ====================
    if (action === "finalize") {
      const body = await req.json();
      const { upload_id, storage_file_name } = body;

      if (!upload_id) {
        return new Response(
          JSON.stringify({ error: "Missing upload_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get session from database
      const { data: session, error: sessionError } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", upload_id)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check all chunks are uploaded
      const { data: progressRaw, error: progressError } = await supabase
        .rpc('get_upload_progress', { p_upload_id: upload_id })
        .single();
      
      const progressData = progressRaw as UploadProgress | null;

      if (progressError) {
        return new Response(
          JSON.stringify({ error: "Failed to verify upload completion" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadedCount = progressData?.uploaded_count || 0;
      const totalChunks = progressData?.total_chunks || session.total_chunks;

      if (uploadedCount !== totalChunks) {
        const uploadedIndices: number[] = progressData?.uploaded_indices || [];
        const missingChunks = Array.from({ length: totalChunks }, (_, i) => i)
          .filter(i => !uploadedIndices.includes(i));

        return new Response(
          JSON.stringify({ 
            error: "Not all chunks uploaded",
            uploaded_chunks: uploadedCount,
            total_chunks: totalChunks,
            missing_chunks: missingChunks
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const finalFileName = storage_file_name || `${upload_id}_file`;
      const storagePath = `${userId}/${finalFileName}`;

      // Create file record in database
      const { data: fileRecord, error: dbError } = await supabase
        .from("files")
        .insert({
          user_id: userId,
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
        console.error("Database insert error:", dbError);
        return new Response(
          JSON.stringify({ error: "Failed to create file record", details: dbError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cleanup: Delete session and chunks
      await supabase
        .from("chunked_upload_sessions")
        .delete()
        .eq("upload_id", upload_id);

      // Chunks are automatically cleaned up via trigger

      console.log(`✅ Telegram chunked upload finalized: ${fileRecord.id}`);

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
    }

    // ==================== STATUS ====================
    if (action === "status") {
      const uploadId = url.searchParams.get("upload_id");

      if (!uploadId) {
        return new Response(
          JSON.stringify({ error: "Missing upload_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("chunked_upload_sessions")
        .select("*")
        .eq("upload_id", uploadId)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: progressRaw } = await supabase
        .rpc('get_upload_progress', { p_upload_id: uploadId })
        .single();
      
      const progressData = progressRaw as UploadProgress | null;

      return new Response(
        JSON.stringify({
          upload_id: uploadId,
          file_name: session.file_name,
          total_chunks: progressData?.total_chunks || session.total_chunks,
          uploaded_chunks: progressData?.uploaded_count || 0,
          uploaded_indices: progressData?.uploaded_indices || [],
          progress: progressData?.progress || 0,
          is_complete: progressData?.is_complete || false,
          expires_at: session.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'init', 'chunk', 'finalize', or 'status'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Telegram chunked upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

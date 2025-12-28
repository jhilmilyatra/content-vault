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

interface ChunkUploadRequest {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  mimeType: string;
  totalSize: number;
  folderId?: string;
}

interface UploadSession {
  uploadId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  folderId: string | null;
  createdAt: string;
  expiresAt: string;
}

// In-memory storage for upload sessions (in production, use Redis or DB)
const uploadSessions = new Map<string, UploadSession>();

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

      const session: UploadSession = {
        uploadId,
        userId: user.id,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        totalSize,
        totalChunks,
        uploadedChunks: [],
        folderId: folderId || null,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      uploadSessions.set(uploadId, session);

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

      const session = uploadSessions.get(uploadId);
      
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.userId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          uploadId: session.uploadId,
          fileName: session.fileName,
          totalChunks: session.totalChunks,
          uploadedChunks: session.uploadedChunks,
          progress: (session.uploadedChunks.length / session.totalChunks) * 100,
          expiresAt: session.expiresAt,
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

      const session = uploadSessions.get(uploadId);
      
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found or expired" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.userId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if chunk already uploaded
      if (session.uploadedChunks.includes(chunkIndex)) {
        console.log(`⏭️ Chunk ${chunkIndex} already uploaded, skipping`);
        return new Response(
          JSON.stringify({
            success: true,
            chunkIndex,
            skipped: true,
            progress: (session.uploadedChunks.length / session.totalChunks) * 100,
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

      // Mark chunk as uploaded
      session.uploadedChunks.push(chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);

      const progress = (session.uploadedChunks.length / session.totalChunks) * 100;
      console.log(`✅ Chunk ${chunkIndex + 1}/${session.totalChunks} uploaded (${progress.toFixed(1)}%)`);

      return new Response(
        JSON.stringify({
          success: true,
          chunkIndex,
          uploadedChunks: session.uploadedChunks.length,
          totalChunks: session.totalChunks,
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

      const session = uploadSessions.get(uploadId);
      
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Upload session not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (session.userId !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check all chunks are uploaded
      if (session.uploadedChunks.length !== session.totalChunks) {
        return new Response(
          JSON.stringify({ 
            error: "Not all chunks uploaded",
            uploadedChunks: session.uploadedChunks.length,
            totalChunks: session.totalChunks,
            missingChunks: Array.from({ length: session.totalChunks }, (_, i) => i)
              .filter(i => !session.uploadedChunks.includes(i))
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🔧 Assembling ${session.totalChunks} chunks for ${session.fileName}...`);

      // Fetch and combine all chunks
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      for (let i = 0; i < session.totalChunks; i++) {
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
      const ext = session.fileName.split('.').pop() || '';
      const storageName = `file_${timestamp}${randomPart}${ext ? '.' + ext : ''}`;

      const vpsResponse = await fetch(`${VPS_ENDPOINT}/upload-base64`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: storageName,
          originalName: session.fileName,
          mimeType: session.mimeType,
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
          folder_id: session.folderId,
          name: session.fileName,
          original_name: session.fileName,
          mime_type: session.mimeType,
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

      // Clean up chunks (fire and forget)
      const cleanupChunks = async () => {
        for (let i = 0; i < session.totalChunks; i++) {
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
        uploadSessions.delete(uploadId);
        console.log(`🧹 Cleaned up ${session.totalChunks} chunks for upload ${uploadId}`);
      };
      
      // Start cleanup in background
      cleanupChunks().catch(console.error);

      console.log(`✅ Chunked upload complete: ${session.fileName}`);

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
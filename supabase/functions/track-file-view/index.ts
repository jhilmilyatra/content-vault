import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, viewType = 'preview', bytesTransferred = 0 } = await req.json();

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "File ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP and user agent
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     req.headers.get("x-real-ip") || null;
    const userAgent = req.headers.get("user-agent") || null;

    // Get auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user from token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify file exists
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from("files")
      .select("id, size_bytes, user_id")
      .eq("id", fileId)
      .eq("is_deleted", false)
      .single();

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record the view
    const { data: viewId, error: rpcError } = await supabaseAdmin.rpc('record_file_view', {
      p_file_id: fileId,
      p_user_id: user.id,
      p_ip_address: clientIp,
      p_user_agent: userAgent,
      p_view_type: viewType,
      p_bytes_transferred: bytesTransferred > 0 ? bytesTransferred : fileData.size_bytes
    });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: "Failed to record view" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Tracked view: file=${fileId}, user=${user.id}, type=${viewType}`);

    return new Response(
      JSON.stringify({ success: true, viewId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Track file view error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

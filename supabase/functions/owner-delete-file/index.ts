import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
};

// Primary VPS storage
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "DELETE") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Verify user is owner
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Owner access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { fileId, storagePath } = await req.json();

    if (!fileId || !storagePath) {
      return new Response(
        JSON.stringify({ error: "fileId and storagePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🗑️ Owner permanent delete: ${fileId} (${storagePath})`);

    // Parse userId and fileName from storagePath
    // storagePath can be "vps://userId/fileName" or just "userId/fileName"
    const cleanPath = storagePath.replace("vps://", "");
    const pathParts = cleanPath.split("/");
    
    if (pathParts.length < 2) {
      return new Response(
        JSON.stringify({ error: "Invalid storage path format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = pathParts[0];
    const fileName = pathParts.slice(1).join("/");

    // Delete from VPS storage
    let vpsDeleted = false;
    try {
      const deleteResponse = await fetch(`${VPS_ENDPOINT}/delete`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${VPS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, fileName }),
      });
      
      if (deleteResponse.ok) {
        console.log(`✅ Deleted from VPS: ${cleanPath}`);
        vpsDeleted = true;
      } else {
        console.log(`⚠️ VPS delete returned: ${deleteResponse.status}`);
      }
    } catch (e) {
      console.error("VPS delete error:", e);
    }

    // Delete from Supabase storage (if it exists there)
    try {
      await supabase.storage.from("user-files").remove([cleanPath]);
      console.log(`✅ Deleted from Supabase storage: ${cleanPath}`);
    } catch (e) {
      console.log("Supabase storage delete skipped:", e);
    }

    // Delete related shared_links
    await supabase
      .from("shared_links")
      .delete()
      .eq("file_id", fileId);

    // Delete file_views records
    await supabase
      .from("file_views")
      .delete()
      .eq("file_id", fileId);

    // Hard delete the file record from database
    const { error: deleteError } = await supabase
      .from("files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete file record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      entity_type: "file",
      action: "permanent_delete",
      actor_id: user.id,
      entity_id: fileId,
      details: {
        storage_path: cleanPath,
        vps_deleted: vpsDeleted,
        owner_action: true,
      },
    });

    console.log(`✅ Permanent delete complete: ${fileId}`);

    return new Response(
      JSON.stringify({ success: true, vpsDeleted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Owner delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "Delete failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

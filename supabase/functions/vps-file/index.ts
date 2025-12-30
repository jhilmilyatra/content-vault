import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Primary VPS storage - hardcoded
    const envVpsEndpoint = "http://46.38.232.46:4000";
    const envVpsApiKey = "kARTOOS007";

    // Custom VPS from headers
    const headerVpsEndpoint = req.headers.get("x-vps-endpoint");
    const headerVpsApiKey = req.headers.get("x-vps-api-key");

    const url = new URL(req.url);
    const storagePath = url.searchParams.get("path");
    const action = url.searchParams.get("action") || "get"; // get, delete, url

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "No path provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get user role to determine access level
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = userRole?.role || "member";

    // Authorization logic:
    // - Owner: can access all files
    // - Admin: can access all files  
    // - Member: can access their own files OR files that exist in folders they have access to
    const fileOwnerId = storagePath.split("/")[0];
    const isOwnFile = storagePath.startsWith(user.id + "/");
    const isOwnerOrAdmin = role === "owner" || role === "admin";

    let hasAccess = isOwnFile || isOwnerOrAdmin;

    // If not own file and not owner/admin, check if member has access through file table
    if (!hasAccess && role === "member") {
      // Check if the file exists and belongs to the organization (owner uploaded it)
      const { data: fileData } = await supabase
        .from("files")
        .select("id, user_id, folder_id")
        .eq("storage_path", storagePath)
        .eq("is_deleted", false)
        .single();

      if (fileData) {
        // Members can view files uploaded by owner/admins (same organization)
        const { data: fileOwnerRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", fileData.user_id)
          .single();

        // Allow access if file was uploaded by owner or admin
        if (fileOwnerRole?.role === "owner" || fileOwnerRole?.role === "admin") {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which VPS to use
    const vpsEndpoint = headerVpsEndpoint || envVpsEndpoint;
    const vpsApiKey = headerVpsApiKey || envVpsApiKey;

    if (action === "url") {
      // Get URL for file
      if (vpsEndpoint && vpsApiKey) {
        // Check if file exists on VPS
        try {
          const checkResponse = await fetch(`${vpsEndpoint}/files/${storagePath}`, {
            method: "HEAD",
            headers: { "Authorization": `Bearer ${vpsApiKey}` },
          });
          
          if (checkResponse.ok) {
            return new Response(
              JSON.stringify({ url: `${vpsEndpoint}/files/${storagePath}`, storage: "vps" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.log("VPS check failed, trying Supabase");
        }
      }
      
      // Fallback to Supabase signed URL
      const { data, error } = await supabase.storage
        .from("user-files")
        .createSignedUrl(storagePath, 3600);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ url: data.signedUrl, storage: "cloud" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      // Only allow delete if user owns the file or is owner/admin
      if (!isOwnFile && !isOwnerOrAdmin) {
        return new Response(
          JSON.stringify({ error: "Cannot delete files you don't own" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse userId and fileName from storagePath
      const pathParts = storagePath.split("/");
      if (pathParts.length < 2) {
        return new Response(
          JSON.stringify({ error: "Invalid storage path format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = pathParts[0];
      const fileName = pathParts.slice(1).join("/");

      // Delete from VPS
      if (vpsEndpoint && vpsApiKey) {
        try {
          const deleteResponse = await fetch(`${vpsEndpoint}/delete`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${vpsApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, fileName }),
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ Deleted from VPS: ${storagePath}`);
          } else {
            console.log(`VPS delete returned: ${deleteResponse.status}`);
          }
        } catch (e) {
          console.error("VPS delete error:", e);
        }
      }
      
      // Also delete from Supabase storage (if it exists there)
      await supabase.storage.from("user-files").remove([storagePath]);
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get") {
      // Try VPS first
      if (vpsEndpoint && vpsApiKey) {
        try {
          const vpsResponse = await fetch(`${vpsEndpoint}/files/${storagePath}`, {
            headers: { "Authorization": `Bearer ${vpsApiKey}` },
          });
          
          if (vpsResponse.ok) {
            const contentType = vpsResponse.headers.get("Content-Type") || "application/octet-stream";
            const blob = await vpsResponse.blob();
            return new Response(blob, {
              headers: { ...corsHeaders, "Content-Type": contentType },
            });
          }
        } catch (e) {
          console.error("VPS get error:", e);
        }
      }
      
      // Fallback to Supabase storage
      const { data, error } = await supabase.storage
        .from("user-files")
        .download(storagePath);
      
      if (error) throw error;
      
      return new Response(data, {
        headers: { ...corsHeaders, "Content-Type": data.type },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("File operation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

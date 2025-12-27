import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-vps-endpoint, x-vps-api-key",
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

    // Primary VPS storage - hardcoded owner access
    const envVpsEndpoint = "http://46.38.232.46:4000";
    const envVpsOwnerKey = "kARTOOS007";

    const url = new URL(req.url);
    const storagePath = url.searchParams.get("path");
    const action = url.searchParams.get("action") || "get"; // get, delete

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "No path provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check that the caller is an owner
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Owner access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const vpsEndpoint = envVpsEndpoint;
    const vpsOwnerKey = envVpsOwnerKey;

    if (action === "get") {
      // Stream file content for preview/download
      const vpsResponse = await fetch(`${vpsEndpoint}/files/${storagePath}`, {
        headers: { Authorization: `Bearer ${vpsOwnerKey}` },
      });

      if (!vpsResponse.ok) {
        const errorText = await vpsResponse.text().catch(() => "");
        console.error("VPS owner get error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch file" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const contentType =
        vpsResponse.headers.get("Content-Type") || "application/octet-stream";
      const blob = await vpsResponse.blob();

      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
        },
      });
    }

    if (action === "delete") {
      // Parse userId and fileName from storagePath (userId/filename)
      const pathParts = storagePath.split("/");
      if (pathParts.length < 2) {
        return new Response(
          JSON.stringify({ error: "Invalid storage path format" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const userId = pathParts[0];
      const fileName = pathParts.slice(1).join("/");

      const deleteResponse = await fetch(
        `${vpsEndpoint}/owner/file/${userId}/${fileName}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${vpsOwnerKey}`,
          },
        },
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text().catch(() => "");
        console.error("VPS owner delete error:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to delete file" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Owner file operation error:", error);
    const message =
      error instanceof Error ? error.message : "Operation failed";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
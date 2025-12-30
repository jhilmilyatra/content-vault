import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get API token from header
    const apiToken = req.headers.get("x-api-key");
    
    if (!apiToken) {
      console.log("Missing API token");
      return new Response(
        JSON.stringify({ error: "Missing API token. Include x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token format
    if (apiToken.length < 32) {
      console.log("Invalid API token format - too short");
      return new Response(
        JSON.stringify({ error: "Invalid API token format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the provided token and look it up in the database
    const tokenHash = await hashToken(apiToken);
    
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("api_tokens")
      .select("id, user_id, is_active, expires_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !tokenRecord) {
      console.log("Invalid API token - not found in database");
      return new Response(
        JSON.stringify({ error: "Invalid API token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is active
    if (!tokenRecord.is_active) {
      return new Response(
        JSON.stringify({ error: "API token has been deactivated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "API token has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = tokenRecord.user_id;

    // Update last_used_at for the token (non-blocking)
    supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id)
      .then(() => console.log("Updated token last_used_at"));

    // Get query parameters
    const url = new URL(req.url);
    const parentId = url.searchParams.get("parent_id");
    const action = url.searchParams.get("action") || "list";

    if (action === "list") {
      // Fetch user's folders
      let query = supabase
        .from("folders")
        .select("id, name, parent_id, created_at")
        .eq("user_id", userId)
        .order("name", { ascending: true });

      if (parentId) {
        query = query.eq("parent_id", parentId);
      } else {
        query = query.is("parent_id", null);
      }

      const { data: folders, error: foldersError } = await query;

      if (foldersError) {
        console.error("Failed to fetch folders:", foldersError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch folders" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get folder path if parent_id is provided
      interface FolderBreadcrumb { id: string; name: string; parent_id: string | null }
      let breadcrumb: { id: string; name: string }[] = [];
      if (parentId) {
        let currentId: string | null = parentId;
        while (currentId) {
          const { data: folderData } = await supabase
            .from("folders")
            .select("id, name, parent_id")
            .eq("id", currentId)
            .eq("user_id", userId)
            .single() as { data: FolderBreadcrumb | null };
          
          if (folderData) {
            breadcrumb.unshift({ id: folderData.id, name: folderData.name });
            currentId = folderData.parent_id;
          } else {
            break;
          }
        }
      }

      console.log(`📁 Listed ${folders?.length || 0} folders for user ${userId}`);

      return new Response(
        JSON.stringify({
          success: true,
          folders: folders || [],
          breadcrumb,
          parent_id: parentId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      // Create a new folder
      const body = await req.json();
      const { name, parent_id } = body;

      if (!name || name.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Folder name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate parent folder belongs to user
      if (parent_id) {
        const { data: parentFolder } = await supabase
          .from("folders")
          .select("id")
          .eq("id", parent_id)
          .eq("user_id", userId)
          .single() as { data: { id: string } | null };

        if (!parentFolder) {
          return new Response(
            JSON.stringify({ error: "Parent folder not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { data: newFolder, error: createError } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          name: name.trim(),
          parent_id: parent_id || null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create folder:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create folder" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`📁 Created folder "${name}" for user ${userId}`);

      return new Response(
        JSON.stringify({
          success: true,
          folder: newFolder,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'list' or 'create'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Telegram folders error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

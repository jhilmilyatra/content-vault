import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Hardcoded VPS configuration
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_OWNER_KEY = "kARTOOS007";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Check if user is owner
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "all-users";
    const userId = url.searchParams.get("userId");

    let vpsUrl = "";
    
    switch (action) {
      case "all-users":
        vpsUrl = `${VPS_ENDPOINT}/stats/all-users`;
        break;
      case "user":
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId required for user stats" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        vpsUrl = `${VPS_ENDPOINT}/stats/user/${userId}`;
        break;
      case "health":
        vpsUrl = `${VPS_ENDPOINT}/health`;
        break;
      case "owner-files":
        vpsUrl = `${VPS_ENDPOINT}/owner/files`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`📊 Fetching VPS stats: ${vpsUrl}`);

    const vpsResponse = await fetch(vpsUrl, {
      headers: {
        "Authorization": `Bearer ${VPS_OWNER_KEY}`,
      },
    });

    if (!vpsResponse.ok) {
      const errorText = await vpsResponse.text();
      console.error(`VPS error: ${errorText}`);
      throw new Error(`VPS request failed: ${vpsResponse.status}`);
    }

    const vpsData = await vpsResponse.json();

    // For all-users action, enrich with profile data
    if (action === "all-users" && vpsData.users) {
      const userIds = vpsData.users.map((u: any) => u.userId);
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      vpsData.users = vpsData.users.map((u: any) => ({
        ...u,
        profile: profileMap.get(u.userId) || null,
      }));
    }

    return new Response(
      JSON.stringify(vpsData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("VPS stats error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch stats";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
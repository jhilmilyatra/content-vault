import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuspendRequest {
  targetUserId: string;
  suspend: boolean;
  reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client for the authenticated user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Create admin client for role verification and operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has admin or owner role (both can suspend users)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      console.error("Failed to get user role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (roleData.role !== "admin" && roleData.role !== "owner") {
      console.error("User does not have admin or owner role:", roleData.role);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Admin or owner role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User role verified:", roleData.role);

    // Parse request body
    const { targetUserId, suspend, reason }: SuspendRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Target user ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (suspend && !reason?.trim()) {
      return new Response(
        JSON.stringify({ error: "Suspension reason is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-suspension
    if (targetUserId === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot suspend your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check target user's role - admins cannot suspend owners
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .single();

    if (targetRole?.role === "owner" && roleData.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Cannot suspend owner accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetRole?.role === "admin" && roleData.role === "admin") {
      return new Response(
        JSON.stringify({ error: "Admins cannot suspend other admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform the suspension/unsuspension
    const updateData = suspend
      ? {
          is_suspended: true,
          suspension_reason: reason,
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
        }
      : {
          is_suspended: false,
          suspension_reason: null,
          suspended_at: null,
          suspended_by: null,
        };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("user_id", targetUserId);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update user suspension status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log to audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: user.id,
      target_user_id: targetUserId,
      action: suspend ? "user_suspended" : "user_activated",
      entity_type: "profiles",
      details: suspend ? { reason } : { reason: "Unsuspended by admin" },
    });

    console.log(`User ${targetUserId} ${suspend ? "suspended" : "unsuspended"} successfully`);

    return new Response(
      JSON.stringify({ success: true, message: `User ${suspend ? "suspended" : "unsuspended"} successfully` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in admin-suspend-user:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

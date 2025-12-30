import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  targetUserId: string;
  updates: {
    role?: string;
    plan?: string;
    storageLimit?: number;
    bandwidthLimit?: number;
    maxLinks?: number;
    validUntil?: string | null;
    isActive?: boolean;
    liftRestriction?: boolean;
  };
  reason: string;
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

    // Verify user has owner role
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

    if (roleData.role !== "owner") {
      console.error("User does not have owner role:", roleData.role);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Owner role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User role verified as owner");

    // Parse request body
    const { targetUserId, updates, reason }: UpdateUserRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Target user ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reason?.trim()) {
      return new Response(
        JSON.stringify({ error: "Reason is required for audit purposes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current user data for audit logging
    const { data: currentRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .single();

    const { data: currentSub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    // Handle role update
    if (updates.role && updates.role !== currentRole?.role) {
      const { error: roleUpdateError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: updates.role as "owner" | "admin" | "member" })
        .eq("user_id", targetUserId);

      if (roleUpdateError) {
        console.error("Failed to update role:", roleUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to update user role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: user.id,
        target_user_id: targetUserId,
        action: "role_change",
        entity_type: "user_roles",
        details: { previous: currentRole?.role, new: updates.role, reason },
      });

      console.log(`Role updated from ${currentRole?.role} to ${updates.role}`);
    }

    // Handle subscription updates
    const subUpdates: Record<string, unknown> = {};
    
    if (updates.plan) subUpdates.plan = updates.plan;
    if (updates.storageLimit !== undefined) subUpdates.storage_limit_gb = updates.storageLimit;
    if (updates.bandwidthLimit !== undefined) subUpdates.bandwidth_limit_gb = updates.bandwidthLimit;
    if (updates.maxLinks !== undefined) subUpdates.max_active_links = updates.maxLinks;
    if (updates.validUntil !== undefined) subUpdates.valid_until = updates.validUntil;
    if (updates.isActive !== undefined) subUpdates.is_active = updates.isActive;

    // Check if this is a plan upgrade (free -> premium/lifetime)
    const isUpgrade = updates.plan && 
      currentSub?.plan === 'free' && 
      (updates.plan === 'premium' || updates.plan === 'lifetime');

    if (Object.keys(subUpdates).length > 0) {
      // Ensure subscription is active when upgrading
      if (isUpgrade) {
        subUpdates.is_active = true;
      }

      const { error: subUpdateError } = await supabaseAdmin
        .from("subscriptions")
        .update(subUpdates)
        .eq("user_id", targetUserId);

      if (subUpdateError) {
        console.error("Failed to update subscription:", subUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to update subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Auto-unsuspend when upgrading from free plan
      if (isUpgrade) {
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("is_suspended")
          .eq("user_id", targetUserId)
          .single();

        if (profileData?.is_suspended) {
          await supabaseAdmin
            .from("profiles")
            .update({
              is_suspended: false,
              suspended_at: null,
              suspended_by: null,
              suspension_reason: null,
            })
            .eq("user_id", targetUserId);

          await supabaseAdmin.from("audit_logs").insert({
            actor_id: user.id,
            target_user_id: targetUserId,
            action: "auto_unsuspend_on_upgrade",
            entity_type: "profiles",
            details: { new_plan: updates.plan, reason: "Automatically unsuspended due to plan upgrade" },
          });

          console.log("User auto-unsuspended due to plan upgrade:", targetUserId);
        }
      }

      // Log manual override
      await supabaseAdmin.from("manual_overrides").insert({
        user_id: targetUserId,
        granted_by: user.id,
        override_type: "subscription_update",
        previous_value: JSON.stringify({
          plan: currentSub?.plan,
          storage: currentSub?.storage_limit_gb,
          bandwidth: currentSub?.bandwidth_limit_gb,
          links: currentSub?.max_active_links,
        }),
        new_value: JSON.stringify(subUpdates),
        reason,
        expires_at: updates.validUntil || null,
      });

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: user.id,
        target_user_id: targetUserId,
        action: "subscription_update",
        entity_type: "subscriptions",
        details: { updates: subUpdates, reason },
      });

      console.log("Subscription updated:", subUpdates);
    }

    // Handle lift restriction
    if (updates.liftRestriction) {
      const newValidUntil = new Date();
      newValidUntil.setDate(newValidUntil.getDate() + 7);

      await supabaseAdmin
        .from("profiles")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null,
        })
        .eq("user_id", targetUserId);

      await supabaseAdmin
        .from("subscriptions")
        .update({
          is_active: true,
          valid_until: newValidUntil.toISOString(),
        })
        .eq("user_id", targetUserId);

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: user.id,
        target_user_id: targetUserId,
        action: "restriction_lifted",
        entity_type: "profiles",
        details: { new_valid_until: newValidUntil.toISOString(), reason },
      });

      console.log("Restriction lifted for user:", targetUserId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "User updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in owner-update-user:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

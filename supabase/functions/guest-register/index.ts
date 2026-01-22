import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isFeatureEnabled, featureDisabledResponse } from "../_shared/feature-flags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName, shareCode } = await req.json();

    // Validate inputs
    if (!email || !password || !shareCode) {
      return new Response(
        JSON.stringify({ error: "Email, password, and share code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check feature flag for guest registration
    const guestRegistrationEnabled = await isFeatureEnabled(supabaseAdmin, 'feature_guest_registration');
    if (!guestRegistrationEnabled) {
      return featureDisabledResponse('Guest registration', corsHeaders);
    }

    // Verify the share code exists and is active
    const { data: shareData, error: shareError } = await supabaseAdmin
      .from("folder_shares")
      .select("id, folder_id, member_id, is_active")
      .eq("share_code", shareCode)
      .eq("is_active", true)
      .maybeSingle();

    if (shareError) {
      console.error("Share lookup error:", shareError);
      return new Response(
        JSON.stringify({ error: "Failed to verify share link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shareData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired folder share link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from("guest_users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingError) {
      console.error("Existing user lookup error:", existingError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingUser) {
      // User exists, check if already has access to this folder
      const { data: existingAccess } = await supabaseAdmin
        .from("guest_folder_access")
        .select("id")
        .eq("guest_id", existingUser.id)
        .eq("folder_share_id", shareData.id)
        .maybeSingle();

      if (existingAccess) {
        return new Response(
          JSON.stringify({ error: "You already have access to this folder. Please sign in instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add access to existing user
      const { error: accessError } = await supabaseAdmin
        .from("guest_folder_access")
        .insert({
          guest_id: existingUser.id,
          folder_share_id: shareData.id,
          member_id: shareData.member_id,
        });

      if (accessError) {
        console.error("Error adding folder access:", accessError);
        return new Response(
          JSON.stringify({ error: "Failed to add folder access" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Folder added to your account. Please sign in.",
          needsSignIn: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new guest user
    const { data: newGuest, error: createError } = await supabaseAdmin
      .from("guest_users")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: fullName?.trim() || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating guest:", createError);
      if (createError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists. Please sign in instead." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Failed to create account: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add folder access
    const { error: accessError } = await supabaseAdmin
      .from("guest_folder_access")
      .insert({
        guest_id: newGuest.id,
        folder_share_id: shareData.id,
        member_id: shareData.member_id,
      });

    if (accessError) {
      console.error("Error adding folder access:", accessError);
      // Cleanup: delete the guest user if we can't add access
      await supabaseAdmin.from("guest_users").delete().eq("id", newGuest.id);
      return new Response(
        JSON.stringify({ error: "Failed to add folder access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the guest user data (without password_hash)
    const guestUser = {
      id: newGuest.id,
      email: newGuest.email,
      full_name: newGuest.full_name,
      is_banned: newGuest.is_banned,
      ban_reason: newGuest.ban_reason,
      created_at: newGuest.created_at,
    };

    return new Response(
      JSON.stringify({ success: true, guest: guestUser }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest registration error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

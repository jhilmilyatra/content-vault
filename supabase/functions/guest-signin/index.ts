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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Hash password using SHA-256 (same method as registration)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const normalizedEmail = email.toLowerCase().trim();

    // Find guest user
    const { data: guestData, error: guestError } = await supabaseAdmin
      .from("guest_users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (guestError) {
      console.error("Guest lookup error:", guestError);
      return new Response(
        JSON.stringify({ error: "Failed to sign in" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!guestData) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password hash
    if (guestData.password_hash !== passwordHash) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if banned
    if (guestData.is_banned) {
      return new Response(
        JSON.stringify({ 
          error: `Your account has been banned: ${guestData.ban_reason || 'Contact support'}` 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return guest data without password_hash
    const guest = {
      id: guestData.id,
      email: guestData.email,
      full_name: guestData.full_name,
      is_banned: guestData.is_banned,
      ban_reason: guestData.ban_reason,
      created_at: guestData.created_at,
    };

    return new Response(
      JSON.stringify({ success: true, guest }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest sign-in error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

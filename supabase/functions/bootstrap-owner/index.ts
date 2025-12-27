import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Default hardcoded owner credentials (can be overridden via env)
    const ownerEmail = Deno.env.get("OWNER_EMAIL") || "jhilmilyatra@gmail.com";
    const ownerPassword = Deno.env.get("OWNER_PASSWORD") || "kARTOOS@00709";

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists by email
    const { data: listResult, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });

    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to list users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const existingUser = listResult.users.find((u) => u.email === ownerEmail) ?? null;

    let ownerId: string;

    if (existingUser) {
      ownerId = existingUser.id;
      console.log("Owner user already exists:", ownerId);
    } else {
      console.log("Creating owner user with email:", ownerEmail);

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          full_name: "Owner",
        },
      });

      if (createError || !created?.user) {
        console.error("Error creating owner user:", createError);
        return new Response(
          JSON.stringify({ error: createError?.message || "Failed to create owner user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      ownerId = created.user.id;
      console.log("Owner user created:", ownerId);
    }

    // Ensure user_roles has owner role
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (roleError) {
      console.error("Error fetching user role:", roleError);
    }

    if (!roleRow || roleRow.role !== "owner") {
      const { error: upsertRoleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: ownerId, role: "owner" }, { onConflict: "user_id" });

      if (upsertRoleError) {
        console.error("Error setting owner role:", upsertRoleError);
        return new Response(
          JSON.stringify({ error: "Failed to set owner role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.log("Owner role ensured for user:", ownerId);
    }

    // Ensure profile row exists
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!profileRow) {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        user_id: ownerId,
        email: ownerEmail,
        full_name: "Owner",
        is_suspended: false,
      });

      if (profileError) {
        console.error("Error creating owner profile:", profileError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ownerId,
        email: ownerEmail,
        note: "Owner user ensured; you can now sign in with this email and password.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in bootstrap-owner:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
};

const VPS_ENDPOINT = Deno.env.get("VPS_ENDPOINT") || "";
const VPS_API_KEY = Deno.env.get("VPS_API_KEY") || "";

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is owner
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Owner access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { userId, deleteFiles = true } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent owner from deleting themselves
    if (userId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🗑️ Owner deleting user: ${userId}, deleteFiles: ${deleteFiles}`);

    // Get user info before deletion
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const targetEmail = targetUser?.user?.email || "unknown";

    // Get all files for this user (for VPS cleanup)
    const { data: userFiles } = await supabaseAdmin
      .from("files")
      .select("id, storage_path")
      .eq("user_id", userId);

    let filesDeleted = 0;
    let vpsFilesDeleted = 0;

    // Delete files from VPS storage if requested
    if (deleteFiles && userFiles && userFiles.length > 0) {
      for (const file of userFiles) {
        try {
          // Parse storage path
          const cleanPath = file.storage_path?.replace("vps://", "") || "";
          const pathParts = cleanPath.split("/");
          
          if (pathParts.length >= 2) {
            const fileUserId = pathParts[0];
            const fileName = pathParts.slice(1).join("/");
            
            // Delete from VPS
            const deleteResponse = await fetch(`${VPS_ENDPOINT}/delete`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${VPS_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ userId: fileUserId, fileName }),
            });
            
            if (deleteResponse.ok) {
              vpsFilesDeleted++;
            }
          }
          filesDeleted++;
        } catch (e) {
          console.error(`Failed to delete file ${file.id}:`, e);
        }
      }
    }

    // Delete related database records in order (respecting foreign keys)
    
    // 1. Delete file views
    await supabaseAdmin
      .from("file_views")
      .delete()
      .eq("user_id", userId);

    // 2. Delete shared links
    await supabaseAdmin
      .from("shared_links")
      .delete()
      .eq("user_id", userId);

    // 3. Delete files
    await supabaseAdmin
      .from("files")
      .delete()
      .eq("user_id", userId);

    // 4. Delete folders
    await supabaseAdmin
      .from("folders")
      .delete()
      .eq("user_id", userId);

    // 5. Delete folder shares
    await supabaseAdmin
      .from("folder_shares")
      .delete()
      .eq("member_id", userId);

    // 6. Delete chunked upload sessions
    await supabaseAdmin
      .from("chunked_upload_sessions")
      .delete()
      .eq("user_id", userId);

    // 7. Delete video progress
    await supabaseAdmin
      .from("video_progress")
      .delete()
      .eq("user_id", userId);

    // 8. Delete API tokens
    await supabaseAdmin
      .from("api_tokens")
      .delete()
      .eq("user_id", userId);

    // 9. Delete usage metrics
    await supabaseAdmin
      .from("usage_metrics")
      .delete()
      .eq("user_id", userId);

    // 10. Delete subscription
    await supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    // 11. Delete admin permissions (if any)
    await supabaseAdmin
      .from("admin_permissions")
      .delete()
      .eq("user_id", userId);

    // 12. Delete user role
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // 13. Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    // 14. Delete owner-member messages where user is member
    await supabaseAdmin
      .from("owner_member_messages")
      .delete()
      .eq("member_id", userId);

    // 15. Delete member notifications
    await supabaseAdmin
      .from("member_notifications")
      .delete()
      .eq("member_id", userId);

    // 16. Delete typing indicators
    await supabaseAdmin
      .from("typing_indicators")
      .delete()
      .eq("user_id", userId);

    // Finally, delete the auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      return new Response(
        JSON.stringify({ error: "Failed to delete user from auth", details: deleteUserError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    await supabaseAdmin.from("audit_logs").insert({
      entity_type: "user",
      action: "user_deleted",
      actor_id: callerUser.id,
      target_user_id: userId,
      details: {
        deleted_email: targetEmail,
        files_deleted: filesDeleted,
        vps_files_deleted: vpsFilesDeleted,
        owner_action: true,
      },
    });

    console.log(`✅ User deleted: ${userId} (${targetEmail}), ${filesDeleted} files removed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedUserId: userId,
        deletedEmail: targetEmail,
        filesDeleted,
        vpsFilesDeleted
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Owner delete user error:", error);
    const errorMessage = error instanceof Error ? error.message : "Delete failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

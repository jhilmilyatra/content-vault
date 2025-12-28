import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Background job types
type JobType = "cleanup_expired_shares" | "cleanup_trash" | "aggregate_analytics" | "compact_audit_logs";

interface JobResult {
  type: JobType;
  success: boolean;
  processed: number;
  duration: number;
  details?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authorization - only owner or cron can trigger
    const authHeader = req.headers.get("Authorization");
    const cronSecret = req.headers.get("x-cron-secret");
    
    // Allow cron jobs with secret
    const isCron = cronSecret === supabaseServiceKey.substring(0, 32);
    
    if (!isCron && !authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If not cron, verify user is owner
    if (!isCron) {
      const token = authHeader!.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
    }

    const url = new URL(req.url);
    const jobType = url.searchParams.get("job") as JobType | "all";
    
    const results: JobResult[] = [];

    // Run requested jobs
    if (jobType === "all" || jobType === "cleanup_expired_shares") {
      results.push(await cleanupExpiredShares(supabase));
    }

    if (jobType === "all" || jobType === "cleanup_trash") {
      results.push(await cleanupTrash(supabase));
    }

    if (jobType === "all" || jobType === "aggregate_analytics") {
      results.push(await aggregateAnalytics(supabase));
    }

    if (jobType === "all" || jobType === "compact_audit_logs") {
      results.push(await compactAuditLogs(supabase));
    }

    const totalDuration = Date.now() - startTime;
    console.log(`✓ Background jobs completed in ${totalDuration}ms`, results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results, 
        totalDuration 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Background jobs error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Cleanup expired shared links
async function cleanupExpiredShares(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Find and deactivate expired shares (limit batch)
    const { data: expiredShares, error } = await supabase
      .from("shared_links")
      .select("id")
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString())
      .limit(100);

    if (error) throw error;

    if (expiredShares && expiredShares.length > 0) {
      const ids = expiredShares.map((s: any) => s.id);
      
      const { error: updateError } = await supabase
        .from("shared_links")
        .update({ is_active: false })
        .in("id", ids);

      if (updateError) throw updateError;
      processed = expiredShares.length;
    }

    return {
      type: "cleanup_expired_shares",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Cleanup expired shares error:", error);
    return {
      type: "cleanup_expired_shares",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
    };
  }
}

// Permanently delete old trashed files
async function cleanupTrash(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Find files deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldTrash, error } = await supabase
      .from("files")
      .select("id, storage_path, user_id")
      .eq("is_deleted", true)
      .lt("deleted_at", thirtyDaysAgo.toISOString())
      .limit(50);

    if (error) throw error;

    if (oldTrash && oldTrash.length > 0) {
      // Delete from storage
      const storagePaths = oldTrash.map((f: any) => f.storage_path);
      await supabase.storage.from("user-files").remove(storagePaths);

      // Delete from database
      const ids = oldTrash.map((f: any) => f.id);
      const { error: deleteError } = await supabase
        .from("files")
        .delete()
        .in("id", ids);

      if (deleteError) throw deleteError;
      processed = oldTrash.length;

      console.log(`Permanently deleted ${processed} trashed files`);
    }

    return {
      type: "cleanup_trash",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Cleanup trash error:", error);
    return {
      type: "cleanup_trash",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
    };
  }
}

// Aggregate analytics into summary (for read optimization)
async function aggregateAnalytics(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Update usage metrics for all users
    const { data: users, error } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(100);

    if (error) throw error;

    if (users) {
      for (const user of users) {
        // Calculate total storage used
        const { data: storageData } = await supabase
          .from("files")
          .select("size_bytes")
          .eq("user_id", user.user_id)
          .eq("is_deleted", false);

        const totalStorage = storageData?.reduce((sum: number, f: any) => sum + (f.size_bytes || 0), 0) || 0;

        // Count active links
        const { count: activeLinks } = await supabase
          .from("shared_links")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.user_id)
          .eq("is_active", true);

        // Update metrics
        await supabase
          .from("usage_metrics")
          .upsert({
            user_id: user.user_id,
            storage_used_bytes: totalStorage,
            active_links_count: activeLinks || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        processed++;
      }
    }

    return {
      type: "aggregate_analytics",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Aggregate analytics error:", error);
    return {
      type: "aggregate_analytics",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
    };
  }
}

// Compact old audit logs (archive and remove old entries)
async function compactAuditLogs(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Delete audit logs older than 90 days (keep recent history)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: oldLogs, error } = await supabase
      .from("audit_logs")
      .select("id")
      .lt("created_at", ninetyDaysAgo.toISOString())
      .limit(500);

    if (error) throw error;

    if (oldLogs && oldLogs.length > 0) {
      const ids = oldLogs.map((l: any) => l.id);
      
      const { error: deleteError } = await supabase
        .from("audit_logs")
        .delete()
        .in("id", ids);

      if (deleteError) throw deleteError;
      processed = oldLogs.length;

      console.log(`Compacted ${processed} old audit logs`);
    }

    return {
      type: "compact_audit_logs",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Compact audit logs error:", error);
    return {
      type: "compact_audit_logs",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
    };
  }
}

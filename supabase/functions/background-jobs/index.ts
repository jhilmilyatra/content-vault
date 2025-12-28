import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, PAGINATION, VPS_CONFIG } from "../_shared/utils.ts";

// Background job types
type JobType = 
  | "cleanup_expired_shares" 
  | "cleanup_trash" 
  | "aggregate_analytics" 
  | "compact_audit_logs"
  | "storage_health_scan"
  | "archive_old_messages"
  | "expire_subscriptions"
  | "cleanup_typing_indicators";

interface JobResult {
  type: JobType;
  success: boolean;
  processed: number;
  duration: number;
  details?: string;
  retryable?: boolean;
}

interface JobConfig {
  maxRetries: number;
  timeoutMs: number;
  batchSize: number;
}

const JOB_CONFIGS: Record<JobType, JobConfig> = {
  cleanup_expired_shares: { maxRetries: 3, timeoutMs: 30000, batchSize: 100 },
  cleanup_trash: { maxRetries: 3, timeoutMs: 60000, batchSize: 50 },
  aggregate_analytics: { maxRetries: 2, timeoutMs: 120000, batchSize: 100 },
  compact_audit_logs: { maxRetries: 3, timeoutMs: 60000, batchSize: 500 },
  storage_health_scan: { maxRetries: 2, timeoutMs: 30000, batchSize: 100 },
  archive_old_messages: { maxRetries: 3, timeoutMs: 60000, batchSize: 200 },
  expire_subscriptions: { maxRetries: 3, timeoutMs: 30000, batchSize: 50 },
  cleanup_typing_indicators: { maxRetries: 1, timeoutMs: 10000, batchSize: 1000 },
};

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
    
    const isCron = cronSecret === supabaseServiceKey.substring(0, 32);
    
    if (!isCron && !authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const jobType = url.searchParams.get("job") as JobType | "all" | "essential";
    
    const results: JobResult[] = [];

    // Essential jobs (run frequently)
    if (jobType === "all" || jobType === "essential" || jobType === "cleanup_typing_indicators") {
      results.push(await runJobWithRetry("cleanup_typing_indicators", () => cleanupTypingIndicators(supabase)));
    }

    if (jobType === "all" || jobType === "essential" || jobType === "cleanup_expired_shares") {
      results.push(await runJobWithRetry("cleanup_expired_shares", () => cleanupExpiredShares(supabase)));
    }

    if (jobType === "all" || jobType === "essential" || jobType === "expire_subscriptions") {
      results.push(await runJobWithRetry("expire_subscriptions", () => expireSubscriptions(supabase)));
    }

    // Regular jobs
    if (jobType === "all" || jobType === "cleanup_trash") {
      results.push(await runJobWithRetry("cleanup_trash", () => cleanupTrash(supabase)));
    }

    if (jobType === "all" || jobType === "aggregate_analytics") {
      results.push(await runJobWithRetry("aggregate_analytics", () => aggregateAnalytics(supabase)));
    }

    if (jobType === "all" || jobType === "compact_audit_logs") {
      results.push(await runJobWithRetry("compact_audit_logs", () => compactAuditLogs(supabase)));
    }

    if (jobType === "all" || jobType === "archive_old_messages") {
      results.push(await runJobWithRetry("archive_old_messages", () => archiveOldMessages(supabase)));
    }

    if (jobType === "all" || jobType === "storage_health_scan") {
      results.push(await runJobWithRetry("storage_health_scan", () => storageHealthScan(supabase)));
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failedJobs = results.filter(r => !r.success);

    // Log job run to audit
    await supabase.from("audit_logs").insert({
      entity_type: "background_job",
      action: failedJobs.length > 0 ? "partial_failure" : "completed",
      details: {
        jobType,
        results: results.map(r => ({ type: r.type, success: r.success, processed: r.processed })),
        totalDuration,
        successCount,
        failedCount: failedJobs.length,
      },
    });

    console.log(`✓ Background jobs: ${successCount}/${results.length} succeeded in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({ 
        success: failedJobs.length === 0, 
        results, 
        totalDuration,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: failedJobs.length,
        }
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

// Retry wrapper for jobs
async function runJobWithRetry(
  jobType: JobType,
  jobFn: () => Promise<JobResult>
): Promise<JobResult> {
  const config = JOB_CONFIGS[jobType];
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        jobFn(),
        new Promise<JobResult>((_, reject) => 
          setTimeout(() => reject(new Error("Job timeout")), config.timeoutMs)
        ),
      ]);
      
      if (result.success) {
        return result;
      }
      
      // Job completed but failed - check if retryable
      if (!result.retryable && attempt < config.maxRetries) {
        console.warn(`Job ${jobType} failed (attempt ${attempt}), not retryable`);
        return result;
      }
      
      console.warn(`Job ${jobType} failed (attempt ${attempt}/${config.maxRetries})`);
    } catch (error) {
      lastError = error as Error;
      console.error(`Job ${jobType} error (attempt ${attempt}/${config.maxRetries}):`, error);
      
      if (attempt < config.maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  return {
    type: jobType,
    success: false,
    processed: 0,
    duration: 0,
    details: lastError?.message || "Max retries exceeded",
    retryable: true,
  };
}

// Cleanup expired shared links
async function cleanupExpiredShares(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.cleanup_expired_shares;

  try {
    const { data: expiredShares, error } = await supabase
      .from("shared_links")
      .select("id")
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString())
      .limit(config.batchSize);

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
      retryable: true,
    };
  }
}

// Permanently delete old trashed files
async function cleanupTrash(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.cleanup_trash;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: oldTrash, error } = await supabase
      .from("files")
      .select("id, storage_path, user_id")
      .eq("is_deleted", true)
      .lt("deleted_at", thirtyDaysAgo.toISOString())
      .limit(config.batchSize);

    if (error) throw error;

    if (oldTrash && oldTrash.length > 0) {
      const storagePaths = oldTrash.map((f: any) => f.storage_path);
      await supabase.storage.from("user-files").remove(storagePaths);

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
      retryable: true,
    };
  }
}

// Aggregate analytics into summary
async function aggregateAnalytics(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.aggregate_analytics;

  try {
    const { data: users, error } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(config.batchSize);

    if (error) throw error;

    if (users) {
      // Process in parallel batches
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (user: any) => {
          const { data: storageData } = await supabase
            .from("files")
            .select("size_bytes")
            .eq("user_id", user.user_id)
            .eq("is_deleted", false)
            .limit(PAGINATION.MAX_LIMIT);

          const totalStorage = storageData?.reduce((sum: number, f: any) => sum + (f.size_bytes || 0), 0) || 0;

          const { count: activeLinks } = await supabase
            .from("shared_links")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.user_id)
            .eq("is_active", true);

          await supabase
            .from("usage_metrics")
            .upsert({
              user_id: user.user_id,
              storage_used_bytes: totalStorage,
              active_links_count: activeLinks || 0,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          processed++;
        }));
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
      processed,
      duration: Date.now() - startTime,
      details: String(error),
      retryable: true,
    };
  }
}

// Compact old audit logs
async function compactAuditLogs(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.compact_audit_logs;

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: oldLogs, error } = await supabase
      .from("audit_logs")
      .select("id")
      .lt("created_at", ninetyDaysAgo.toISOString())
      .limit(config.batchSize);

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
      retryable: true,
    };
  }
}

// Archive old guest messages (>90 days)
async function archiveOldMessages(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.archive_old_messages;

  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // For now, we just delete old messages. In production, you'd archive to cold storage
    const { data: oldMessages, error } = await supabase
      .from("guest_messages")
      .select("id")
      .lt("created_at", ninetyDaysAgo.toISOString())
      .limit(config.batchSize);

    if (error) throw error;

    if (oldMessages && oldMessages.length > 0) {
      const ids = oldMessages.map((m: any) => m.id);
      
      // In production: Archive to S3/cold storage first
      // await archiveToS3(oldMessages);
      
      const { error: deleteError } = await supabase
        .from("guest_messages")
        .delete()
        .in("id", ids);

      if (deleteError) throw deleteError;
      processed = oldMessages.length;

      console.log(`Archived ${processed} old messages`);
    }

    return {
      type: "archive_old_messages",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Archive old messages error:", error);
    return {
      type: "archive_old_messages",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
      retryable: true,
    };
  }
}

// Storage health scan
async function storageHealthScan(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Check VPS health
    const vpsResponse = await fetch(`${VPS_CONFIG.endpoint}/health`, {
      headers: { "Authorization": `Bearer ${VPS_CONFIG.apiKey}` },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (vpsResponse && vpsResponse.ok) {
      const health = await vpsResponse.json();
      
      // Log health to audit
      await supabase.from("audit_logs").insert({
        entity_type: "storage_health",
        action: "scan",
        details: {
          vps: {
            status: "healthy",
            diskUsage: health.diskUsage,
            freeSpace: health.freeSpace,
          },
        },
      });
      
      processed = 1;
    } else {
      // Log unhealthy status
      await supabase.from("audit_logs").insert({
        entity_type: "storage_health",
        action: "scan_warning",
        details: {
          vps: { status: "unhealthy" },
        },
      });
    }

    return {
      type: "storage_health_scan",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Storage health scan error:", error);
    return {
      type: "storage_health_scan",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
      retryable: true,
    };
  }
}

// Expire subscriptions
async function expireSubscriptions(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;
  const config = JOB_CONFIGS.expire_subscriptions;

  try {
    // Find expired free subscriptions
    const { data: expiredSubs, error } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("plan", "free")
      .eq("is_active", true)
      .lt("valid_until", new Date().toISOString())
      .limit(config.batchSize);

    if (error) throw error;

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        // Deactivate subscription
        await supabase
          .from("subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);

        // Suspend user
        await supabase
          .from("profiles")
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspension_reason: "Demo period expired. Please upgrade to continue.",
          })
          .eq("user_id", sub.user_id);

        processed++;
      }

      console.log(`Expired ${processed} subscriptions`);
    }

    return {
      type: "expire_subscriptions",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Expire subscriptions error:", error);
    return {
      type: "expire_subscriptions",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
      retryable: true,
    };
  }
}

// Cleanup stale typing indicators
async function cleanupTypingIndicators(supabase: any): Promise<JobResult> {
  const startTime = Date.now();
  let processed = 0;

  try {
    // Delete typing indicators older than 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

    const { data: stale, error } = await supabase
      .from("typing_indicators")
      .delete()
      .lt("updated_at", thirtySecondsAgo)
      .select("id");

    if (error) throw error;

    processed = stale?.length || 0;

    return {
      type: "cleanup_typing_indicators",
      success: true,
      processed,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Cleanup typing indicators error:", error);
    return {
      type: "cleanup_typing_indicators",
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      details: String(error),
      retryable: false,
    };
  }
}

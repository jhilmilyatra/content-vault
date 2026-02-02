import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ExportResult {
  exportedAt: string;
  tables: Record<string, any[]>;
  schema: {
    tables: any[];
    columns: any[];
    foreignKeys: any[];
    indexes: any[];
  };
  rlsPolicies: any[];
  functions: any[];
  triggers: any[];
  storageBuckets: any[];
  secrets: string[];
  edgeFunctions: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for full access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create user client to verify permissions
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is owner
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Only owners can export data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";
    const includeData = url.searchParams.get("includeData") !== "false";

    const result: ExportResult = {
      exportedAt: new Date().toISOString(),
      tables: {},
      schema: {
        tables: [],
        columns: [],
        foreignKeys: [],
        indexes: [],
      },
      rlsPolicies: [],
      functions: [],
      triggers: [],
      storageBuckets: [],
      secrets: [],
      edgeFunctions: [],
    };

    // 1. Get all tables in public schema
    // Fallback: query information_schema directly
    const { data: tableList } = await supabaseAdmin
      .from("information_schema.tables" as any)
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE");

    const tableNames = [
      "profiles", "files", "folders", "shared_links", "folder_shares",
      "guest_users", "guest_folder_access", "guest_messages", "guest_video_progress",
      "user_roles", "subscriptions", "usage_metrics", "api_tokens",
      "admin_permissions", "audit_logs", "reports", "file_views",
      "video_progress", "member_notifications", "owner_member_messages",
      "typing_indicators", "system_settings", "manual_overrides",
      "chunked_upload_sessions", "upload_chunks"
    ];

    // 2. Export table data
    if (includeData) {
      for (const tableName of tableNames) {
        try {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select("*")
            .limit(10000);
          
          if (!error && data) {
            result.tables[tableName] = data;
          }
        } catch (e) {
          console.log(`Skipping table ${tableName}:`, e);
        }
      }
    }

    // 3. Get schema information using raw SQL
    const schemaQueries = {
      // Get all table info
      tables: `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `,
      // Get all columns
      columns: `
        SELECT 
          table_name,
          column_name,
          data_type,
          column_default,
          is_nullable,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `,
      // Get foreign keys
      foreignKeys: `
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
      `,
      // Get indexes
      indexes: `
        SELECT
          tablename AS table_name,
          indexname AS index_name,
          indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `,
      // Get RLS policies
      rlsPolicies: `
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `,
      // Get functions
      functions: `
        SELECT
          p.proname AS function_name,
          pg_get_functiondef(p.oid) AS definition,
          l.lanname AS language,
          p.prosecdef AS security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_language l ON p.prolang = l.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
      `,
      // Get triggers
      triggers: `
        SELECT
          trigger_name,
          event_manipulation,
          event_object_table,
          action_statement,
          action_timing
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      `,
    };

    // Execute schema queries using RPC or direct fetch
    for (const [key, query] of Object.entries(schemaQueries)) {
      try {
        // Use the Supabase REST API to run raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          if (key === "tables" || key === "columns" || key === "foreignKeys" || key === "indexes") {
            result.schema[key as keyof typeof result.schema] = data;
          } else if (key === "rlsPolicies") {
            result.rlsPolicies = data;
          } else if (key === "functions") {
            result.functions = data;
          } else if (key === "triggers") {
            result.triggers = data;
          }
        }
      } catch (e) {
        console.log(`Query ${key} failed:`, e);
      }
    }

    // 4. Get storage buckets
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      result.storageBuckets = buckets || [];
    } catch (e) {
      console.log("Failed to get storage buckets:", e);
    }

    // 5. List edge functions (from known list since we can't query them)
    result.edgeFunctions = [
      "admin-suspend-user",
      "background-jobs",
      "create-user",
      "data-export",
      "guest-file-proxy",
      "guest-file-stream",
      "guest-folder-contents",
      "guest-folder-zip",
      "guest-folders",
      "guest-hls-url",
      "guest-messages",
      "guest-register",
      "guest-signin",
      "guest-stream-url",
      "health",
      "owner-delete-file",
      "owner-update-user",
      "reset-guest-password",
      "reset-user-password",
      "shared-download",
      "sign-hls-url",
      "system-monitor",
      "telegram-chunked-upload",
      "telegram-folders",
      "telegram-upload",
      "track-file-view",
      "update-thumbnail",
      "update-video-metadata",
      "verify-share-link",
      "video-stream",
      "vps-chunked-upload",
      "vps-file",
      "vps-health",
      "vps-owner-stats",
      "vps-upload",
    ];

    // 6. List secrets (names only, not values)
    result.secrets = [
      "VPS_API_KEY",
      "VPS_CALLBACK_KEY", 
      "VPS_CDN_URL",
      "VPS_ENDPOINT",
      "SUPABASE_URL",
      "SUPABASE_DB_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
    ];

    // Format response
    if (format === "sql") {
      // Generate SQL dump
      let sqlDump = `-- Database Export\n-- Generated: ${result.exportedAt}\n\n`;
      
      // Add table data as INSERT statements
      for (const [tableName, rows] of Object.entries(result.tables)) {
        if (rows.length > 0) {
          sqlDump += `\n-- Table: ${tableName}\n`;
          for (const row of rows) {
            const columns = Object.keys(row).join(", ");
            const values = Object.values(row)
              .map(v => {
                if (v === null) return "NULL";
                if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
                if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                return v;
              })
              .join(", ");
            sqlDump += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
          }
        }
      }

      return new Response(sqlDump, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="export-${new Date().toISOString().split("T")[0]}.sql"`,
        },
      });
    }

    // Return JSON
    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": format === "download" 
          ? `attachment; filename="export-${new Date().toISOString().split("T")[0]}.json"`
          : undefined,
      } as HeadersInit,
    });

  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Export failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

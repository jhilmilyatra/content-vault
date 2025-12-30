import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Performance tracking
const SLOW_THRESHOLD_MS = 200;

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = { requests: 30, windowMs: 60000 };

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  
  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT.requests) return false;
  existing.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const { guestId, limit = 100, offset = 0 } = await req.json();

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: "Guest ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit by guest ID
    if (!checkRateLimit(`guest:${guestId}`)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", retryAfter: 60 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Quick guest validation
    const { data: guestData, error: guestError } = await supabaseAdmin
      .from("guest_users")
      .select("id, is_banned")
      .eq("id", guestId)
      .single();

    if (guestError || !guestData) {
      return new Response(
        JSON.stringify({ error: "Guest not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guestData.is_banned) {
      return new Response(
        JSON.stringify({ error: "Account is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    // ✅ OPTIMIZED: Single RPC call instead of 4+ separate queries
    const { data: foldersData, error: foldersError } = await supabaseAdmin
      .rpc('get_guest_folders_fast', {
        p_guest_id: guestId,
        p_limit: safeLimit,
        p_offset: safeOffset
      });

    const dbTime = performance.now() - startTime;

    if (foldersError) {
      console.error("Error fetching guest folders:", foldersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folder access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform to expected format
    const folders = (foldersData || []).map((row: any) => ({
      id: row.access_id,
      folder_share_id: row.folder_share_id,
      member_id: row.member_id,
      added_at: row.added_at,
      is_restricted: false,
      folder_share: {
        folder_id: row.folder_id,
        is_active: true,
        folder: {
          name: row.folder_name,
          description: row.folder_description,
        },
      },
      member_name: row.member_name || "Unknown",
    }));

    const totalTime = performance.now() - startTime;
    if (totalTime > SLOW_THRESHOLD_MS) {
      console.warn(`⚠️ SLOW_EDGE [guest-folders] ${Math.round(totalTime)}ms (db: ${Math.round(dbTime)}ms) for guest ${guestId}`);
    }

    return new Response(
      JSON.stringify({ 
        folders, 
        total: folders.length,
        limit: safeLimit,
        offset: safeOffset
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          // ✅ CACHE: Cache folder listings for 30s
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60"
        } 
      }
    );
  } catch (error) {
    console.error("Guest folders error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

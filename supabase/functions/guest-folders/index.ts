import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pagination limits
const MAX_FOLDERS = 100;

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

function getClientIP(req: Request): string {
  return req.headers.get("cf-connecting-ip") || 
         req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { guestId, limit = MAX_FOLDERS, offset = 0 } = await req.json();

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

    // Verify guest exists
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

    // Fetch guest folder access with LIMIT
    const safeLimit = Math.min(Math.max(1, limit), MAX_FOLDERS);
    const safeOffset = Math.max(0, offset);

    const { data: accessData, error: accessError, count } = await supabaseAdmin
      .from("guest_folder_access")
      .select("id, folder_share_id, member_id, added_at, is_restricted", { count: "exact" })
      .eq("guest_id", guestId)
      .eq("is_restricted", false)
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (accessError) {
      console.error("Error fetching guest folder access:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folder access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accessData || accessData.length === 0) {
      return new Response(
        JSON.stringify({ folders: [], total: 0, limit: safeLimit, offset: safeOffset }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique folder_share_ids
    const folderShareIds = [...new Set(accessData.map(a => a.folder_share_id))];

    // Parallel fetch folder shares, folders, and profiles
    const [sharesResult, memberIds] = await Promise.all([
      supabaseAdmin
        .from("folder_shares")
        .select("id, folder_id, is_active")
        .in("id", folderShareIds)
        .eq("is_active", true)
        .limit(MAX_FOLDERS),
      Promise.resolve([...new Set(accessData.map(a => a.member_id))])
    ]);

    if (sharesResult.error || !sharesResult.data || sharesResult.data.length === 0) {
      return new Response(
        JSON.stringify({ folders: [], total: 0, limit: safeLimit, offset: safeOffset }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const folderIds = [...new Set(sharesResult.data.map(s => s.folder_id))];

    // Parallel fetch folders and profiles
    const [foldersResult, profilesResult] = await Promise.all([
      supabaseAdmin
        .from("folders")
        .select("id, name, description")
        .in("id", folderIds)
        .limit(MAX_FOLDERS),
      supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", memberIds)
        .limit(MAX_FOLDERS)
    ]);

    // Build lookup maps
    const sharesMap = new Map(sharesResult.data.map(s => [s.id, s]));
    const foldersMap = new Map(foldersResult.data?.map(f => [f.id, f]) || []);
    const profilesMap = new Map(profilesResult.data?.map(p => [p.user_id, p.full_name]) || []);

    // Combine data
    const folders = accessData
      .map(access => {
        const share = sharesMap.get(access.folder_share_id);
        if (!share) return null;

        const folder = foldersMap.get(share.folder_id);
        if (!folder) return null;

        return {
          id: access.id,
          folder_share_id: access.folder_share_id,
          member_id: access.member_id,
          added_at: access.added_at,
          is_restricted: access.is_restricted,
          folder_share: {
            folder_id: share.folder_id,
            is_active: share.is_active,
            folder: {
              name: folder.name,
              description: folder.description,
            },
          },
          member_name: profilesMap.get(access.member_id) || "Unknown",
        };
      })
      .filter(Boolean);

    const duration = Date.now() - startTime;
    if (duration > 200) {
      console.warn(`⚠️ SLOW guest-folders: ${duration}ms for guest ${guestId}`);
    }

    return new Response(
      JSON.stringify({ 
        folders, 
        total: count || folders.length,
        limit: safeLimit,
        offset: safeOffset
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest folders error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

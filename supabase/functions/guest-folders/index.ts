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
    const { guestId } = await req.json();

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: "Guest ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to bypass RLS
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

    // Fetch guest folder access with folder and share details
    const { data: accessData, error: accessError } = await supabaseAdmin
      .from("guest_folder_access")
      .select("id, folder_share_id, member_id, added_at, is_restricted")
      .eq("guest_id", guestId)
      .eq("is_restricted", false);

    if (accessError) {
      console.error("Error fetching guest folder access:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folder access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accessData || accessData.length === 0) {
      return new Response(
        JSON.stringify({ folders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique folder_share_ids
    const folderShareIds = [...new Set(accessData.map(a => a.folder_share_id))];

    // Fetch folder shares
    const { data: sharesData, error: sharesError } = await supabaseAdmin
      .from("folder_shares")
      .select("id, folder_id, is_active")
      .in("id", folderShareIds)
      .eq("is_active", true);

    if (sharesError) {
      console.error("Error fetching folder shares:", sharesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folder shares" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sharesData || sharesData.length === 0) {
      return new Response(
        JSON.stringify({ folders: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique folder_ids
    const folderIds = [...new Set(sharesData.map(s => s.folder_id))];

    // Fetch folders
    const { data: foldersData, error: foldersError } = await supabaseAdmin
      .from("folders")
      .select("id, name, description")
      .in("id", folderIds);

    if (foldersError) {
      console.error("Error fetching folders:", foldersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch folders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique member_ids
    const memberIds = [...new Set(accessData.map(a => a.member_id))];

    // Fetch member profiles
    const { data: profilesData } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", memberIds);

    // Build lookup maps
    const sharesMap = new Map(sharesData.map(s => [s.id, s]));
    const foldersMap = new Map(foldersData?.map(f => [f.id, f]) || []);
    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

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

    return new Response(
      JSON.stringify({ folders }),
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

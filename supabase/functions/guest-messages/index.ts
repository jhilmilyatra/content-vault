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
    const { action, guestId, memberId, message, markAsRead } = await req.json();

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: "Guest ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify guest exists
    const { data: guest, error: guestError } = await supabaseAdmin
      .from("guest_users")
      .select("id, is_banned")
      .eq("id", guestId)
      .maybeSingle();

    if (guestError || !guest) {
      return new Response(
        JSON.stringify({ error: "Invalid guest" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (guest.is_banned) {
      return new Response(
        JSON.stringify({ error: "Your account is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    if (action === "getConversations") {
      // Get all members this guest has access to
      const { data: accessData, error: accessError } = await supabaseAdmin
        .from("guest_folder_access")
        .select("member_id")
        .eq("guest_id", guestId)
        .eq("is_restricted", false);

      if (accessError) {
        console.error("Access lookup error:", accessError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch conversations" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const memberIds = [...new Set((accessData || []).map((a: any) => a.member_id))];

      // Get member profiles
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", memberIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.user_id, p.full_name]) || []);

      // Build conversation list with last message and unread count
      const conversations = [];

      for (const memberId of memberIds) {
        // Get last message
        const { data: lastMsg } = await supabaseAdmin
          .from("guest_messages")
          .select("message, created_at")
          .eq("guest_id", guestId)
          .eq("member_id", memberId)
          .order("created_at", { ascending: false })
          .limit(1);

        // Get unread count
        const { count: unreadCount } = await supabaseAdmin
          .from("guest_messages")
          .select("id", { count: "exact", head: true })
          .eq("guest_id", guestId)
          .eq("member_id", memberId)
          .eq("sender_type", "member")
          .eq("is_read", false);

        conversations.push({
          member_id: memberId,
          member_name: profileMap.get(memberId) || "Member",
          last_message: lastMsg?.[0]?.message || "No messages yet",
          last_message_at: lastMsg?.[0]?.created_at || "",
          unread_count: unreadCount || 0,
        });
      }

      return new Response(
        JSON.stringify({ success: true, conversations }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getMessages") {
      if (!memberId) {
        return new Response(
          JSON.stringify({ error: "Member ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify guest has access to this member
      const { data: access } = await supabaseAdmin
        .from("guest_folder_access")
        .select("id")
        .eq("guest_id", guestId)
        .eq("member_id", memberId)
        .eq("is_restricted", false)
        .maybeSingle();

      if (!access) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: messages, error: msgError } = await supabaseAdmin
        .from("guest_messages")
        .select("*")
        .eq("guest_id", guestId)
        .eq("member_id", memberId)
        .order("created_at", { ascending: true });

      if (msgError) {
        console.error("Message fetch error:", msgError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch messages" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark messages as read if requested
      if (markAsRead) {
        await supabaseAdmin
          .from("guest_messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("guest_id", guestId)
          .eq("member_id", memberId)
          .eq("sender_type", "member")
          .eq("is_read", false);
      }

      return new Response(
        JSON.stringify({ success: true, messages }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sendMessage") {
      if (!memberId || !message) {
        return new Response(
          JSON.stringify({ error: "Member ID and message are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify guest has access to this member
      const { data: access } = await supabaseAdmin
        .from("guest_folder_access")
        .select("id")
        .eq("guest_id", guestId)
        .eq("member_id", memberId)
        .eq("is_restricted", false)
        .maybeSingle();

      if (!access) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert message
      const { data: newMessage, error: insertError } = await supabaseAdmin
        .from("guest_messages")
        .insert({
          guest_id: guestId,
          member_id: memberId,
          sender_type: "guest",
          message: message.trim(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Message insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to send message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create notification for member
      await supabaseAdmin.from("member_notifications").insert({
        member_id: memberId,
        type: "new_message",
        title: "New message from guest",
        message: message.trim().substring(0, 100),
        related_guest_id: guestId,
      });

      return new Response(
        JSON.stringify({ success: true, message: newMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest messages error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

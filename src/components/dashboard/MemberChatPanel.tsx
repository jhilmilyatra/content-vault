import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, X, Search, Crown, Users } from "lucide-react";
import { format } from "date-fns";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReadReceipt from "@/components/chat/ReadReceipt";

interface Guest {
  id: string;
  email: string;
  full_name: string | null;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

interface GuestMessage {
  id: string;
  guest_id: string;
  member_id: string;
  sender_type: "guest" | "member";
  message: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

interface OwnerMessage {
  id: string;
  owner_id: string;
  member_id: string;
  sender_type: "owner" | "member";
  message: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

interface MemberChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MemberChatPanel = ({ isOpen, onClose }: MemberChatPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"guests" | "owner">("guests");
  
  // Guest chat state
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [guestNewMessage, setGuestNewMessage] = useState("");
  const [guestTotalUnread, setGuestTotalUnread] = useState(0);
  
  // Owner chat state
  const [ownerMessages, setOwnerMessages] = useState<OwnerMessage[]>([]);
  const [ownerNewMessage, setOwnerNewMessage] = useState("");
  const [ownerUnreadCount, setOwnerUnreadCount] = useState(0);
  
  // Typing indicators
  const [guestTyping, setGuestTyping] = useState(false);
  const [ownerTyping, setOwnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [guestMessages, ownerMessages, guestTyping, ownerTyping]);

  // Update typing indicator
  const updateTypingStatus = async (chatType: string, targetId: string, typing: boolean) => {
    if (!user) return;
    try {
      await supabase.from("typing_indicators").upsert(
        {
          user_id: user.id,
          chat_type: chatType,
          target_id: targetId,
          is_typing: typing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chat_type,target_id" }
      );
    } catch (error) {
      console.error("Typing status error:", error);
    }
  };

  const handleGuestInputChange = (value: string) => {
    setGuestNewMessage(value);
    if (selectedGuest) {
      updateTypingStatus("guest_member", selectedGuest.id, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus("guest_member", selectedGuest.id, false);
      }, 2000);
    }
  };

  const handleOwnerInputChange = async (value: string) => {
    setOwnerNewMessage(value);
    const { data: ownerId } = await supabase.rpc("get_owner_user_id");
    if (ownerId) {
      updateTypingStatus("owner_member", ownerId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus("owner_member", ownerId, false);
      }, 2000);
    }
  };

  // Fetch guests
  const fetchGuests = async () => {
    if (!user) return;

    try {
      const { data: guestAccess } = await supabase
        .from("guest_folder_access")
        .select(`guest_id, guest_users!inner (id, email, full_name)`)
        .eq("member_id", user.id);

      const uniqueGuests = new Map<string, Guest>();
      guestAccess?.forEach((access: any) => {
        if (!uniqueGuests.has(access.guest_id)) {
          uniqueGuests.set(access.guest_id, {
            id: access.guest_users.id,
            email: access.guest_users.email,
            full_name: access.guest_users.full_name,
            unread_count: 0,
          });
        }
      });

      const { data: unreadMessages } = await supabase
        .from("guest_messages")
        .select("guest_id")
        .eq("member_id", user.id)
        .eq("sender_type", "guest")
        .eq("is_read", false);

      const unreadCounts = new Map<string, number>();
      unreadMessages?.forEach(msg => {
        unreadCounts.set(msg.guest_id, (unreadCounts.get(msg.guest_id) || 0) + 1);
      });

      const { data: lastMessages } = await supabase
        .from("guest_messages")
        .select("guest_id, message, created_at")
        .eq("member_id", user.id)
        .order("created_at", { ascending: false });

      const lastMessageMap = new Map<string, { message: string; time: string }>();
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.guest_id)) {
          lastMessageMap.set(msg.guest_id, { message: msg.message, time: msg.created_at });
        }
      });

      const guestList: Guest[] = Array.from(uniqueGuests.values()).map(g => ({
        ...g,
        unread_count: unreadCounts.get(g.id) || 0,
        last_message: lastMessageMap.get(g.id)?.message,
        last_message_time: lastMessageMap.get(g.id)?.time,
      }));

      guestList.sort((a, b) => {
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        if (a.last_message_time && b.last_message_time) {
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        }
        return 0;
      });

      setGuests(guestList);
      setFilteredGuests(guestList);
      setGuestTotalUnread(guestList.reduce((sum, g) => sum + g.unread_count, 0));
    } catch (error) {
      console.error("Error fetching guests:", error);
    }
  };

  // Fetch guest messages
  const fetchGuestMessages = async (guestId: string) => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("guest_messages")
        .select("*")
        .eq("member_id", user.id)
        .eq("guest_id", guestId)
        .order("created_at", { ascending: true });

      setGuestMessages((data || []) as GuestMessage[]);

      await supabase
        .from("guest_messages")
        .update({ is_read: true })
        .eq("member_id", user.id)
        .eq("guest_id", guestId)
        .eq("sender_type", "guest")
        .eq("is_read", false);

      setGuests(prev => prev.map(g => (g.id === guestId ? { ...g, unread_count: 0 } : g)));
      setFilteredGuests(prev => prev.map(g => (g.id === guestId ? { ...g, unread_count: 0 } : g)));
      setGuestTotalUnread(prev => {
        const guest = guests.find(g => g.id === guestId);
        return Math.max(0, prev - (guest?.unread_count || 0));
      });
    } catch (error) {
      console.error("Error fetching guest messages:", error);
    }
  };

  // Fetch owner messages
  const fetchOwnerMessages = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("owner_member_messages")
        .select("*")
        .eq("member_id", user.id)
        .order("created_at", { ascending: true });

      setOwnerMessages((data || []) as OwnerMessage[]);

      if (isOpen && activeTab === "owner") {
        await supabase
          .from("owner_member_messages")
          .update({ is_read: true })
          .eq("member_id", user.id)
          .eq("sender_type", "owner")
          .eq("is_read", false);
        setOwnerUnreadCount(0);
      }
    } catch (error) {
      console.error("Error fetching owner messages:", error);
    }
  };

  const fetchOwnerUnreadCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from("owner_member_messages")
      .select("*", { count: "exact", head: true })
      .eq("member_id", user.id)
      .eq("sender_type", "owner")
      .eq("is_read", false);

    setOwnerUnreadCount(count || 0);
  };

  useEffect(() => {
    if (user) {
      fetchGuests();
      fetchOwnerMessages();
      fetchOwnerUnreadCount();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGuest) {
      fetchGuestMessages(selectedGuest.id);
    }
  }, [selectedGuest]);

  useEffect(() => {
    if (isOpen && activeTab === "owner") {
      fetchOwnerMessages();
    }
  }, [isOpen, activeTab]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const guestChannel = supabase
      .channel("member-guest-messages-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "guest_messages", filter: `member_id=eq.${user.id}` },
        (payload) => {
          const newMsg = payload.new as GuestMessage;
          if (selectedGuest && newMsg.guest_id === selectedGuest.id) {
            setGuestMessages(prev => [...prev, newMsg]);
            if (newMsg.sender_type === "guest") {
              supabase.from("guest_messages").update({ is_read: true }).eq("id", newMsg.id);
            }
          } else if (newMsg.sender_type === "guest") {
            setGuests(prev => prev.map(g =>
              g.id === newMsg.guest_id
                ? { ...g, unread_count: g.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                : g
            ));
            setFilteredGuests(prev => prev.map(g =>
              g.id === newMsg.guest_id
                ? { ...g, unread_count: g.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                : g
            ));
            setGuestTotalUnread(prev => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "guest_messages", filter: `member_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as GuestMessage;
          setGuestMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    const ownerChannel = supabase
      .channel("member-owner-messages-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "owner_member_messages", filter: `member_id=eq.${user.id}` },
        (payload) => {
          const newMsg = payload.new as OwnerMessage;
          setOwnerMessages(prev => [...prev, newMsg]);
          if (newMsg.sender_type === "owner" && (!isOpen || activeTab !== "owner")) {
            setOwnerUnreadCount(prev => prev + 1);
          } else if (newMsg.sender_type === "owner" && isOpen && activeTab === "owner") {
            supabase.from("owner_member_messages").update({ is_read: true }).eq("id", newMsg.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "owner_member_messages", filter: `member_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as OwnerMessage;
          setOwnerMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    // Typing indicators subscription
    const typingChannel = supabase
      .channel("typing-indicators-member")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators" },
        (payload: any) => {
          const data = payload.new;
          if (!data) return;
          
          // Check if it's for current guest chat
          if (selectedGuest && data.target_id === user.id && data.chat_type === "guest_member") {
            setGuestTyping(data.is_typing);
            if (data.is_typing) {
              setTimeout(() => setGuestTyping(false), 3000);
            }
          }
          
          // Check if it's owner typing
          if (data.target_id === user.id && data.chat_type === "owner_member") {
            setOwnerTyping(data.is_typing);
            if (data.is_typing) {
              setTimeout(() => setOwnerTyping(false), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(guestChannel);
      supabase.removeChannel(ownerChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [user, selectedGuest, isOpen, activeTab]);

  useEffect(() => {
    if (guestSearchQuery) {
      const query = guestSearchQuery.toLowerCase();
      setFilteredGuests(guests.filter(g =>
        g.email.toLowerCase().includes(query) || g.full_name?.toLowerCase().includes(query)
      ));
    } else {
      setFilteredGuests(guests);
    }
  }, [guestSearchQuery, guests]);

  const handleSendGuestMessage = async () => {
    if (!guestNewMessage.trim() || !selectedGuest || !user) return;

    setSending(true);
    try {
      if (selectedGuest) {
        updateTypingStatus("guest_member", selectedGuest.id, false);
      }
      await supabase.from("guest_messages").insert({
        member_id: user.id,
        guest_id: selectedGuest.id,
        sender_type: "member",
        message: guestNewMessage.trim(),
      });
      setGuestNewMessage("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendOwnerMessage = async () => {
    if (!ownerNewMessage.trim() || !user) return;

    setSending(true);
    try {
      const { data: ownerId, error: ownerError } = await supabase.rpc("get_owner_user_id");

      if (ownerError) {
        console.error("Error getting owner:", ownerError);
        toast({ title: "Error", description: "Could not find owner. Please try again.", variant: "destructive" });
        return;
      }

      if (!ownerId) {
        toast({ title: "Error", description: "No owner configured for this system.", variant: "destructive" });
        return;
      }

      updateTypingStatus("owner_member", ownerId, false);

      const { error: insertError } = await supabase.from("owner_member_messages").insert({
        owner_id: ownerId,
        member_id: user.id,
        sender_type: "member",
        message: ownerNewMessage.trim(),
      });

      if (insertError) throw insertError;

      setOwnerNewMessage("");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    return email[0].toUpperCase();
  };

  const totalUnread = guestTotalUnread + ownerUnreadCount;

  if (!isOpen) {
    return (
      <Button
        onClick={onClose}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[420px] h-[520px] z-50 flex flex-col shadow-2xl border-2">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-muted/30">
        <CardTitle className="text-base font-semibold">Messages</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "guests" | "owner")} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b bg-transparent h-11 p-0">
          <TabsTrigger
            value="guests"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full gap-2"
          >
            <Users className="h-4 w-4" />
            Guests
            {guestTotalUnread > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {guestTotalUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="owner"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full gap-2"
          >
            <Crown className="h-4 w-4" />
            Owner
            {ownerUnreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {ownerUnreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Guest Chat Tab */}
        <TabsContent value="guests" className="flex-1 flex overflow-hidden m-0 data-[state=inactive]:hidden">
          <div className="w-2/5 border-r flex flex-col">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={guestSearchQuery}
                  onChange={(e) => setGuestSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredGuests.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">No guests</div>
              ) : (
                filteredGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className={`p-2.5 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedGuest?.id === guest.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedGuest(guest)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(guest.full_name, guest.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs truncate">
                            {guest.full_name || guest.email.split("@")[0]}
                          </span>
                          {guest.unread_count > 0 && (
                            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                              {guest.unread_count}
                            </Badge>
                          )}
                        </div>
                        {guest.last_message && (
                          <p className="text-[10px] text-muted-foreground truncate">{guest.last_message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedGuest ? (
              <>
                <div className="p-2.5 border-b bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(selectedGuest.full_name, selectedGuest.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{selectedGuest.full_name || selectedGuest.email}</div>
                      {guestTyping && <TypingIndicator compact />}
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-2">
                    {guestMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8 text-xs">No messages yet</div>
                    ) : (
                      guestMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_type === "member" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                            msg.sender_type === "member" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}>
                            <p className="text-xs leading-relaxed">{msg.message}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender_type === "member" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              <span className="text-[10px]">{format(new Date(msg.created_at), "h:mm a")}</span>
                              {msg.sender_type === "member" && (
                                <ReadReceipt isRead={msg.is_read} readAt={msg.read_at} size="sm" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {guestTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl px-3 py-2">
                          <TypingIndicator compact />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-2.5 border-t bg-muted/20">
                  <div className="flex gap-2">
                    <Input
                      value={guestNewMessage}
                      onChange={(e) => handleGuestInputChange(e.target.value)}
                      placeholder="Type a message..."
                      className="text-xs h-9"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendGuestMessage(); }}}
                    />
                    <Button size="sm" className="h-9 px-3" onClick={handleSendGuestMessage} disabled={sending || !guestNewMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center p-4">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select a guest</p>
                  <p className="text-xs text-muted-foreground mt-1">Choose a guest to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Owner Chat Tab */}
        <TabsContent value="owner" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
          <div className="p-2 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-amber-500/20 text-amber-600">
                  <Crown className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium text-xs">Owner Support</div>
                {ownerTyping && <TypingIndicator compact />}
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {ownerMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Crown className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Contact the Owner</p>
                  <p className="text-xs text-muted-foreground mt-1">Send a message to get help or support</p>
                </div>
              ) : (
                ownerMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === "member" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                      msg.sender_type === "member" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <p className="text-xs leading-relaxed">{msg.message}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender_type === "member" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        <span className="text-[10px]">{format(new Date(msg.created_at), "MMM d, h:mm a")}</span>
                        {msg.sender_type === "member" && (
                          <ReadReceipt isRead={msg.is_read} readAt={msg.read_at} size="sm" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {ownerTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <TypingIndicator compact />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <div className="p-2.5 border-t bg-muted/20">
            <div className="flex gap-2">
              <Input
                value={ownerNewMessage}
                onChange={(e) => handleOwnerInputChange(e.target.value)}
                placeholder="Message the owner..."
                className="text-xs h-9"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendOwnerMessage(); }}}
              />
              <Button size="sm" className="h-9 px-3" onClick={handleSendOwnerMessage} disabled={sending || !ownerNewMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default MemberChatPanel;

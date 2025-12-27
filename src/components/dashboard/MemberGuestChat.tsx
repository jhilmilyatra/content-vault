import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, X, Search } from "lucide-react";
import { format } from "date-fns";

interface Guest {
  id: string;
  email: string;
  full_name: string | null;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

interface Message {
  id: string;
  guest_id: string;
  member_id: string;
  sender_type: "guest" | "member";
  message: string;
  is_read: boolean;
  created_at: string;
}

interface MemberGuestChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const MemberGuestChat = ({ isOpen, onClose }: MemberGuestChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchGuests = async () => {
    if (!user) return;

    try {
      // Get guests with access to member's folders
      const { data: guestAccess, error: accessError } = await supabase
        .from("guest_folder_access")
        .select(`
          guest_id,
          guest_users!inner (
            id,
            email,
            full_name
          )
        `)
        .eq("member_id", user.id);

      if (accessError) throw accessError;

      // Get unique guests
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

      // Get unread message counts
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

      // Get last messages
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

      // Sort by unread count, then by last message time
      guestList.sort((a, b) => {
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        if (a.last_message_time && b.last_message_time) {
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        }
        return 0;
      });

      setGuests(guestList);
      setFilteredGuests(guestList);
      setTotalUnread(guestList.reduce((sum, g) => sum + g.unread_count, 0));
    } catch (error: any) {
      console.error("Error fetching guests:", error);
    }
  };

  const fetchMessages = async (guestId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("guest_messages")
        .select("*")
        .eq("member_id", user.id)
        .eq("guest_id", guestId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data as Message[]);

      // Mark messages as read
      await supabase
        .from("guest_messages")
        .update({ is_read: true })
        .eq("member_id", user.id)
        .eq("guest_id", guestId)
        .eq("sender_type", "guest")
        .eq("is_read", false);

      // Update local state
      setGuests(prev =>
        prev.map(g => (g.id === guestId ? { ...g, unread_count: 0 } : g))
      );
      setFilteredGuests(prev =>
        prev.map(g => (g.id === guestId ? { ...g, unread_count: 0 } : g))
      );
      setTotalUnread(prev => {
        const guest = guests.find(g => g.id === guestId);
        return prev - (guest?.unread_count || 0);
      });
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGuests();
    }
  }, [user]);

  useEffect(() => {
    if (selectedGuest) {
      fetchMessages(selectedGuest.id);
    }
  }, [selectedGuest]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("member-guest-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guest_messages",
          filter: `member_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedGuest && newMsg.guest_id === selectedGuest.id) {
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.sender_type === "guest") {
              supabase
                .from("guest_messages")
                .update({ is_read: true })
                .eq("id", newMsg.id);
            }
          } else if (newMsg.sender_type === "guest") {
            setGuests(prev =>
              prev.map(g =>
                g.id === newMsg.guest_id
                  ? { ...g, unread_count: g.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                  : g
              )
            );
            setFilteredGuests(prev =>
              prev.map(g =>
                g.id === newMsg.guest_id
                  ? { ...g, unread_count: g.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                  : g
              )
            );
            setTotalUnread(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedGuest]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredGuests(
        guests.filter(
          g =>
            g.email.toLowerCase().includes(query) ||
            g.full_name?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredGuests(guests);
    }
  }, [searchQuery, guests]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedGuest || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from("guest_messages").insert({
        member_id: user.id,
        guest_id: selectedGuest.id,
        sender_type: "member",
        message: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={onClose}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Guest Messages
        {totalUnread > 0 && (
          <Badge variant="destructive" className="ml-2">
            {totalUnread}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-[500px] h-[550px] z-50 flex flex-col shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-base">Guest Messages</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <div className="flex flex-1 overflow-hidden">
        {/* Guest List */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredGuests.length === 0 ? (
              <div className="p-3 text-center text-muted-foreground text-xs">No guests</div>
            ) : (
              filteredGuests.map((guest) => (
                <div
                  key={guest.id}
                  className={`p-2 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedGuest?.id === guest.id ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedGuest(guest)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {getInitials(guest.full_name, guest.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs truncate">
                          {guest.full_name || guest.email.split("@")[0]}
                        </span>
                        {guest.unread_count > 0 && (
                          <Badge variant="default" className="ml-1 h-4 text-[10px] px-1">
                            {guest.unread_count}
                          </Badge>
                        )}
                      </div>
                      {guest.last_message && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {guest.last_message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedGuest ? (
            <>
              <div className="p-2 border-b">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(selectedGuest.full_name, selectedGuest.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-xs">
                      {selectedGuest.full_name || selectedGuest.email}
                    </div>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 text-xs">
                      No messages yet
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.sender_type === "member" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-2 py-1.5 ${
                            msg.sender_type === "member"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-xs">{msg.message}</p>
                          <p
                            className={`text-[10px] mt-0.5 ${
                              msg.sender_type === "member"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <CardContent className="p-2 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button size="sm" className="h-8" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Select a guest to chat</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MemberGuestChat;

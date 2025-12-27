import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, Users, Search } from "lucide-react";
import { format } from "date-fns";

interface Member {
  user_id: string;
  email: string;
  full_name: string | null;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

interface Message {
  id: string;
  owner_id: string;
  member_id: string;
  sender_type: "owner" | "member";
  message: string;
  is_read: boolean;
  created_at: string;
}

const OwnerMemberChat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      // Get all members (users with member role)
      const { data: memberRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "member");

      if (rolesError) throw rolesError;

      const memberIds = memberRoles?.map(r => r.user_id) || [];

      if (memberIds.length === 0) {
        setMembers([]);
        setFilteredMembers([]);
        setLoading(false);
        return;
      }

      // Get member profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", memberIds);

      if (profilesError) throw profilesError;

      // Get unread message counts per member
      const { data: unreadMessages, error: unreadError } = await supabase
        .from("owner_member_messages")
        .select("member_id")
        .eq("sender_type", "member")
        .eq("is_read", false);

      if (unreadError) throw unreadError;

      const unreadCounts = new Map<string, number>();
      unreadMessages?.forEach(msg => {
        unreadCounts.set(msg.member_id, (unreadCounts.get(msg.member_id) || 0) + 1);
      });

      // Get last messages for each member
      const { data: lastMessages, error: lastError } = await supabase
        .from("owner_member_messages")
        .select("member_id, message, created_at")
        .order("created_at", { ascending: false });

      if (lastError) throw lastError;

      const lastMessageMap = new Map<string, { message: string; time: string }>();
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.member_id)) {
          lastMessageMap.set(msg.member_id, { message: msg.message, time: msg.created_at });
        }
      });

      const formattedMembers: Member[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        email: p.email || "",
        full_name: p.full_name,
        unread_count: unreadCounts.get(p.user_id) || 0,
        last_message: lastMessageMap.get(p.user_id)?.message,
        last_message_time: lastMessageMap.get(p.user_id)?.time,
      }));

      // Sort by unread count, then by last message time
      formattedMembers.sort((a, b) => {
        if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
        if (a.last_message_time && b.last_message_time) {
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        }
        return 0;
      });

      setMembers(formattedMembers);
      setFilteredMembers(formattedMembers);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (memberId: string) => {
    try {
      const { data, error } = await supabase
        .from("owner_member_messages")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data as Message[]);

      // Mark messages as read
      await supabase
        .from("owner_member_messages")
        .update({ is_read: true })
        .eq("member_id", memberId)
        .eq("sender_type", "member")
        .eq("is_read", false);

      // Update unread count in local state
      setMembers(prev =>
        prev.map(m =>
          m.user_id === memberId ? { ...m, unread_count: 0 } : m
        )
      );
      setFilteredMembers(prev =>
        prev.map(m =>
          m.user_id === memberId ? { ...m, unread_count: 0 } : m
        )
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      fetchMessages(selectedMember.user_id);
    }
  }, [selectedMember]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("owner-member-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "owner_member_messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedMember && newMsg.member_id === selectedMember.user_id) {
            setMessages(prev => [...prev, newMsg]);
            // Mark as read if from member
            if (newMsg.sender_type === "member") {
              supabase
                .from("owner_member_messages")
                .update({ is_read: true })
                .eq("id", newMsg.id);
            }
          } else if (newMsg.sender_type === "member") {
            // Update unread count for other members
            setMembers(prev =>
              prev.map(m =>
                m.user_id === newMsg.member_id
                  ? { ...m, unread_count: m.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                  : m
              )
            );
            setFilteredMembers(prev =>
              prev.map(m =>
                m.user_id === newMsg.member_id
                  ? { ...m, unread_count: m.unread_count + 1, last_message: newMsg.message, last_message_time: newMsg.created_at }
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMember]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredMembers(
        members.filter(
          m =>
            m.email.toLowerCase().includes(query) ||
            m.full_name?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedMember || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from("owner_member_messages").insert({
        owner_id: user.id,
        member_id: selectedMember.user_id,
        sender_type: "owner",
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

  const totalUnread = members.reduce((sum, m) => sum + m.unread_count, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Member Chat</h1>
          <p className="text-muted-foreground">
            Communicate with your members
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnread}</div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <Card className="h-[600px]">
          <div className="flex h-full">
            {/* Members List */}
            <div className="w-1/3 border-r flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : filteredMembers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No members found</div>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedMember?.user_id === member.user_id ? "bg-muted" : ""
                      }`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(member.full_name, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {member.full_name || member.email}
                            </span>
                            {member.unread_count > 0 && (
                              <Badge variant="default" className="ml-2">
                                {member.unread_count}
                              </Badge>
                            )}
                          </div>
                          {member.last_message && (
                            <p className="text-sm text-muted-foreground truncate">
                              {member.last_message}
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
              {selectedMember ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(selectedMember.full_name, selectedMember.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {selectedMember.full_name || selectedMember.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedMember.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender_type === "owner" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-4 py-2 ${
                              msg.sender_type === "owner"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p>{msg.message}</p>
                            <p
                              className={`text-xs mt-1 ${
                                msg.sender_type === "owner"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {format(new Date(msg.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a member to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default OwnerMemberChat;

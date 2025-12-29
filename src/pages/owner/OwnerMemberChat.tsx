import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition, staggerContainer, staggerItem } from "@/components/ui/PageTransition";
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
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReadReceipt from "@/components/chat/ReadReceipt";

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
  read_at?: string | null;
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
  const [memberTyping, setMemberTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, memberTyping]);

  // Update typing indicator
  const updateTypingStatus = async (memberId: string, typing: boolean) => {
    if (!user) return;
    try {
      await supabase.from("typing_indicators").upsert(
        {
          user_id: user.id,
          chat_type: "owner_member",
          target_id: memberId,
          is_typing: typing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chat_type,target_id" }
      );
    } catch (error) {
      console.error("Typing status error:", error);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (selectedMember) {
      updateTypingStatus(selectedMember.user_id, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(selectedMember.user_id, false);
      }, 2000);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
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

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", memberIds);

      if (profilesError) throw profilesError;

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

      setMessages((data || []) as Message[]);

      await supabase
        .from("owner_member_messages")
        .update({ is_read: true })
        .eq("member_id", memberId)
        .eq("sender_type", "member")
        .eq("is_read", false);

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
    if (!user) return;

    const channel = supabase
      .channel("owner-member-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "owner_member_messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedMember && newMsg.member_id === selectedMember.user_id) {
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.sender_type === "member") {
              supabase
                .from("owner_member_messages")
                .update({ is_read: true })
                .eq("id", newMsg.id);
            }
          } else if (newMsg.sender_type === "member") {
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "owner_member_messages" },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    // Typing indicator subscription
    const typingChannel = supabase
      .channel("owner-typing-indicators")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators" },
        (payload: any) => {
          const data = payload.new;
          if (!data || !selectedMember) return;
          
          if (data.target_id === user.id && data.chat_type === "owner_member") {
            setMemberTyping(data.is_typing);
            if (data.is_typing) {
              setTimeout(() => setMemberTyping(false), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
    };
  }, [selectedMember, user]);

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
      if (selectedMember) {
        updateTypingStatus(selectedMember.user_id, false);
      }

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
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            Member Chat
          </h1>
          <p className="text-white/50 mt-1">
            Communicate with your members
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2"
        >
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Total Members</CardTitle>
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{members.length}</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={staggerItem}>
            <Card className="bg-white/[0.02] backdrop-blur-xl border-white/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70">Unread Messages</CardTitle>
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <MessageSquare className="h-4 w-4 text-violet-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{totalUnread}</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-[600px] bg-white/[0.02] backdrop-blur-xl border-white/10 overflow-hidden">
            <div className="flex h-full">
              {/* Members List */}
              <div className="w-1/3 border-r border-white/10 flex flex-col">
                <div className="p-4 border-b border-white/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {loading ? (
                    <div className="p-4 text-center text-white/50">Loading...</div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="p-4 text-center text-white/50">No members found</div>
                  ) : (
                    filteredMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 ${
                          selectedMember?.user_id === member.user_id 
                            ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-l-2 border-l-violet-500" 
                            : "hover:bg-white/5"
                        }`}
                        onClick={() => setSelectedMember(member)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="border border-white/10">
                            <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-white">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-white truncate">
                                {member.full_name || member.email}
                              </span>
                              {member.unread_count > 0 && (
                                <Badge className="ml-2 bg-violet-500 text-white">
                                  {member.unread_count}
                                </Badge>
                              )}
                            </div>
                            {member.last_message && (
                              <p className="text-sm text-white/50 truncate">
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
              <div className="flex-1 flex flex-col bg-black/20">
                {selectedMember ? (
                  <>
                    <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <Avatar className="border border-white/10">
                          <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-white">
                            {getInitials(selectedMember.full_name, selectedMember.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-white">
                            {selectedMember.full_name || selectedMember.email}
                          </div>
                          <div className="text-sm text-white/50">
                            {memberTyping ? <TypingIndicator /> : selectedMember.email}
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
                              className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                                msg.sender_type === "owner"
                                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                                  : "bg-white/10 text-white"
                              }`}
                            >
                              <p>{msg.message}</p>
                              <div
                                className={`flex items-center justify-end gap-1 text-xs mt-1 ${
                                  msg.sender_type === "owner"
                                    ? "text-white/70"
                                    : "text-white/50"
                                }`}
                              >
                                <span>{format(new Date(msg.created_at), "MMM d, h:mm a")}</span>
                                {msg.sender_type === "owner" && (
                                  <ReadReceipt isRead={msg.is_read} readAt={msg.read_at} />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {memberTyping && (
                          <div className="flex justify-start">
                            <div className="bg-white/10 rounded-2xl px-4 py-3">
                              <TypingIndicator name={selectedMember.full_name || selectedMember.email.split("@")[0]} />
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                      <div className="flex gap-3">
                        <Input
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => handleInputChange(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                          className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          disabled={sending || !newMessage.trim()}
                          className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 w-fit mx-auto mb-4">
                        <MessageSquare className="h-8 w-8 text-violet-400" />
                      </div>
                      <h3 className="text-lg font-medium text-white">Select a member to chat</h3>
                      <p className="text-white/50 text-sm mt-1">Choose a member from the list to start messaging</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default OwnerMemberChat;

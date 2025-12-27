import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  owner_id: string;
  member_id: string;
  sender_type: "owner" | "member";
  message: string;
  is_read: boolean;
  created_at: string;
}

interface MemberOwnerChatProps {
  isOpen: boolean;
  onClose: () => void;
}

const MemberOwnerChat = ({ isOpen, onClose }: MemberOwnerChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("owner_member_messages")
        .select("*")
        .eq("member_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(data as Message[]);

      // Mark owner messages as read when chat is open
      if (isOpen) {
        await supabase
          .from("owner_member_messages")
          .update({ is_read: true })
          .eq("member_id", user.id)
          .eq("sender_type", "owner")
          .eq("is_read", false);
        setUnreadCount(0);
      }
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user) return;

    const { count } = await supabase
      .from("owner_member_messages")
      .select("*", { count: "exact", head: true })
      .eq("member_id", user.id)
      .eq("sender_type", "owner")
      .eq("is_read", false);

    setUnreadCount(count || 0);
  };

  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchUnreadCount();
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchMessages();
    }
  }, [isOpen]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("member-owner-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "owner_member_messages",
          filter: `member_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
          
          if (newMsg.sender_type === "owner" && !isOpen) {
            setUnreadCount(prev => prev + 1);
          } else if (newMsg.sender_type === "owner" && isOpen) {
            // Mark as read immediately
            supabase
              .from("owner_member_messages")
              .update({ is_read: true })
              .eq("id", newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOpen]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      // Get owner id (any owner will work for now)
      const { data: ownerRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "owner")
        .limit(1)
        .single();

      if (!ownerRole) {
        toast({
          title: "Error",
          description: "No owner found",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("owner_member_messages").insert({
        owner_id: ownerRole.user_id,
        member_id: user.id,
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

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={onClose}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Contact Owner
        {unreadCount > 0 && (
          <Badge variant="destructive" className="ml-2">
            {unreadCount}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[500px] z-50 flex flex-col shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-base">Contact Owner</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Send a message to the owner</p>
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
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.sender_type === "member"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p
                    className={`text-xs mt-1 ${
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
      <CardContent className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button size="sm" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberOwnerChat;

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Send,
  MessageCircle,
  User,
  ChevronLeft,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  id: string;
  guest_id: string;
  member_id: string;
  sender_type: 'guest' | 'member';
  message: string;
  is_read: boolean;
  created_at: string;
}

interface MemberConversation {
  member_id: string;
  member_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

const GuestHelpDesk = () => {
  const navigate = useNavigate();
  const { guest, loading: authLoading } = useGuestAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<MemberConversation[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !guest) {
      navigate('/guest-auth');
    }
  }, [guest, authLoading, navigate]);

  // Fetch conversations via edge function
  const fetchConversations = async () => {
    if (!guest) return;

    try {
      const { data, error } = await supabase.functions.invoke('guest-messages', {
        body: { action: 'getConversations', guestId: guest.id }
      });

      if (error) throw error;

      if (data?.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load conversations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [guest]);

  // Fetch messages via edge function
  const fetchMessages = async (memberId: string) => {
    if (!guest) return;

    try {
      const { data, error } = await supabase.functions.invoke('guest-messages', {
        body: { 
          action: 'getMessages', 
          guestId: guest.id, 
          memberId,
          markAsRead: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        setMessages(data.messages.map((m: any) => ({
          ...m,
          sender_type: m.sender_type as 'guest' | 'member'
        })));
        
        // Update unread count in conversations
        setConversations(prev => prev.map(c => 
          c.member_id === memberId ? { ...c, unread_count: 0 } : c
        ));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (selectedMember) {
      fetchMessages(selectedMember);
    }
  }, [selectedMember]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!guest) return;

    const channel = supabase
      .channel('guest-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guest_messages',
          filter: `guest_id=eq.${guest.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          if (selectedMember && newMsg.member_id === selectedMember) {
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read via edge function
            if (newMsg.sender_type === 'member') {
              supabase.functions.invoke('guest-messages', {
                body: { 
                  action: 'getMessages', 
                  guestId: guest.id, 
                  memberId: selectedMember,
                  markAsRead: true
                }
              });
            }
          } else if (newMsg.sender_type === 'member') {
            // Update unread count
            setConversations(prev => prev.map(c => 
              c.member_id === newMsg.member_id 
                ? { ...c, unread_count: c.unread_count + 1, last_message: newMsg.message, last_message_at: newMsg.created_at }
                : c
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guest, selectedMember]);

  const handleSelectMember = (memberId: string) => {
    setSelectedMember(memberId);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBackToList = () => {
    setShowChat(false);
  };

  const handleSendMessage = async () => {
    if (!guest || !selectedMember || !newMessage.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('guest-messages', {
        body: { 
          action: 'sendMessage', 
          guestId: guest.id, 
          memberId: selectedMember,
          message: newMessage.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Message will appear via realtime subscription
        setNewMessage('');
      } else {
        throw new Error(data?.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!guest) return null;

  // Mobile chat view
  if (isMobile && showChat && selectedMember) {
    const selectedConversation = conversations.find(c => c.member_id === selectedMember);
    
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Mobile Chat Header */}
        <header className="border-b border-border bg-card p-4 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBackToList}
            className="touch-manipulation"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedConversation?.member_name}</p>
            <p className="text-xs text-muted-foreground">Folder Owner</p>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const showDate =
                index === 0 ||
                formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center text-xs text-muted-foreground my-4">
                      {formatDate(msg.created_at)}
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.sender_type === 'guest' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.sender_type === 'guest'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_type === 'guest'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-border bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className="touch-manipulation"
            />
            <Button 
              type="submit" 
              disabled={sending || !newMessage.trim()}
              className="touch-manipulation"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/guest-portal')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Portal
            </Button>
          </div>
          <h1 className="font-semibold text-foreground">Help Desk</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
          {/* Conversations List */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Conversations
              </CardTitle>
              <CardDescription>Contact folder owners</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-20rem)]">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No conversations yet. You'll be able to chat with folder owners here.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {conversations.map((conv) => (
                      <button
                        key={conv.member_id}
                        onClick={() => handleSelectMember(conv.member_id)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors touch-manipulation ${
                          selectedMember === conv.member_id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">{conv.member_name}</p>
                              {conv.unread_count > 0 && (
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.last_message}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Messages - Desktop Only */}
          {!isMobile && (
            <Card className="md:col-span-2 flex flex-col">
              {selectedMember ? (
                <>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg">
                      {conversations.find((c) => c.member_id === selectedMember)?.member_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 flex flex-col">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.map((msg, index) => {
                          const showDate =
                            index === 0 ||
                            formatDate(messages[index - 1].created_at) !==
                              formatDate(msg.created_at);

                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="text-center text-xs text-muted-foreground my-4">
                                  {formatDate(msg.created_at)}
                                </div>
                              )}
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${
                                  msg.sender_type === 'guest' ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                    msg.sender_type === 'guest'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted'
                                  }`}
                                >
                                  <p className="text-sm">{msg.message}</p>
                                  <p
                                    className={`text-xs mt-1 ${
                                      msg.sender_type === 'guest'
                                        ? 'text-primary-foreground/70'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {formatTime(msg.created_at)}
                                  </p>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <div className="p-4 border-t">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          disabled={sending}
                        />
                        <Button type="submit" disabled={sending || !newMessage.trim()}>
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to start messaging</p>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default GuestHelpDesk;

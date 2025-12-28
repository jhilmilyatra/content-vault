import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGuestTypingIndicator } from '@/hooks/useGuestTypingIndicator';
import TypingIndicator from '@/components/chat/TypingIndicator';
import {
  ArrowLeft,
  Loader2,
  Send,
  MessageCircle,
  User,
  ChevronLeft,
  Check,
  CheckCheck,
} from 'lucide-react';

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
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Typing indicator hook
  const { remoteTyping, handleInputChange: handleTypingChange, stopTyping } = useGuestTypingIndicator({
    guestId: guest?.id || '',
    memberId: selectedMember || '',
  });

  useEffect(() => {
    if (!authLoading && !guest) {
      navigate('/guest-auth');
    }
  }, [guest, authLoading, navigate]);

  const fetchConversations = useCallback(async () => {
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
  }, [guest, toast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (memberId: string) => {
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
        
        setConversations(prev => prev.map(c => 
          c.member_id === memberId ? { ...c, unread_count: 0 } : c
        ));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [guest]);

  useEffect(() => {
    if (selectedMember) {
      fetchMessages(selectedMember);
    }
  }, [selectedMember, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, remoteTyping]);

  // Real-time message subscription - optimized for instant updates
  useEffect(() => {
    if (!guest) return;

    console.log('[GuestHelpDesk] Setting up real-time subscription for guest:', guest.id);

    const channel = supabase
      .channel(`guest-chat-${guest.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guest_messages',
          filter: `guest_id=eq.${guest.id}`,
        },
        (payload) => {
          console.log('[GuestHelpDesk] New message received:', payload);
          const newMsg = payload.new as Message;
          
          if (selectedMember && newMsg.member_id === selectedMember) {
            // Add message to current conversation immediately
            setMessages((prev) => {
              // Prevent duplicates - check for real ID or temp messages with same content
              if (prev.some(m => m.id === newMsg.id)) return prev;
              // Replace any temp message with same content (optimistic update)
              const hasTempWithSameContent = prev.some(
                m => m.id.startsWith('temp-') && m.message === newMsg.message && m.sender_type === newMsg.sender_type
              );
              if (hasTempWithSameContent) {
                return prev.map(m => 
                  m.id.startsWith('temp-') && m.message === newMsg.message && m.sender_type === newMsg.sender_type
                    ? newMsg
                    : m
                );
              }
              return [...prev, newMsg];
            });
            
            // Mark as read if it's from member
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
          }
          
          // Update conversation list
          if (newMsg.sender_type === 'member' && newMsg.member_id !== selectedMember) {
            setConversations(prev => prev.map(c => 
              c.member_id === newMsg.member_id 
                ? { 
                    ...c, 
                    unread_count: c.unread_count + 1, 
                    last_message: newMsg.message, 
                    last_message_at: newMsg.created_at 
                  }
                : c
            ));
          } else {
            // Update last message for current conversation
            setConversations(prev => prev.map(c => 
              c.member_id === newMsg.member_id 
                ? { ...c, last_message: newMsg.message, last_message_at: newMsg.created_at }
                : c
            ));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guest_messages',
          filter: `guest_id=eq.${guest.id}`,
        },
        (payload) => {
          console.log('[GuestHelpDesk] Message updated:', payload);
          const updatedMsg = payload.new as Message;
          
          // Update read status in current messages
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id ? { ...m, is_read: updatedMsg.is_read } : m
          ));
        }
      )
      .subscribe((status) => {
        console.log('[GuestHelpDesk] Subscription status:', status);
      });

    return () => {
      console.log('[GuestHelpDesk] Cleaning up subscription');
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
    stopTyping();
    setShowChat(false);
    setSelectedMember(null);
    setMessages([]);
  };

  const handleInputChangeWithTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleTypingChange();
  };

  const handleSendMessage = async () => {
    if (!guest || !selectedMember || !newMessage.trim()) return;

    stopTyping();
    
    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Clear input IMMEDIATELY for instant feedback
    setNewMessage('');
    
    // Optimistic update - add message immediately to UI (no delay)
    const optimisticMessage: Message = {
      id: tempId,
      guest_id: guest.id,
      member_id: selectedMember,
      sender_type: 'guest',
      message: messageText,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    
    // Use functional updates and batch state changes
    setMessages(prev => [...prev, optimisticMessage]);
    setConversations(prev => prev.map(c => 
      c.member_id === selectedMember 
        ? { ...c, last_message: messageText, last_message_at: optimisticMessage.created_at }
        : c
    ));
    
    // Scroll immediately on mobile
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    });
    
    // Send in background - don't block UI with setSending
    try {
      const { data, error } = await supabase.functions.invoke('guest-messages', {
        body: { 
          action: 'sendMessage', 
          guestId: guest.id, 
          memberId: selectedMember,
          message: messageText
        }
      });

      if (error) throw error;

      if (data?.success && data.message) {
        // Replace optimistic message with real one from server
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...data.message, sender_type: 'guest' as const } : m
        ));
      } else {
        // Remove optimistic message and restore input
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(messageText);
        throw new Error(data?.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
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

  const selectedConversation = conversations.find(c => c.member_id === selectedMember);

  // Mobile: Full screen chat view
  if (isMobile && showChat && selectedMember) {
    return (
      <div className="h-[100dvh] flex flex-col bg-background">
        {/* Mobile Chat Header */}
        <header className="border-b border-border bg-card px-3 py-3 flex items-center gap-3 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBackToList}
            className="touch-manipulation h-10 w-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{selectedConversation?.member_name}</p>
            {remoteTyping ? (
              <TypingIndicator compact />
            ) : (
              <p className="text-xs text-muted-foreground">Folder Owner</p>
            )}
          </div>
        </header>

        {/* Messages - Scrollable area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="px-3 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No messages yet. Start the conversation!
              </div>
            )}
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
                  <div
                    className={`flex ${msg.sender_type === 'guest' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.sender_type === 'guest'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      } ${msg.id.startsWith('temp-') ? 'opacity-90' : ''}`}
                    >
                      <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                      <div className={`flex items-center gap-1 mt-1 ${
                        msg.sender_type === 'guest' ? 'justify-end' : ''
                      }`}>
                        <p
                          className={`text-[10px] ${
                            msg.sender_type === 'guest'
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                        {msg.sender_type === 'guest' && (
                          msg.id.startsWith('temp-') ? (
                            <Loader2 className="w-3 h-3 text-primary-foreground/70 animate-spin" />
                          ) : msg.is_read ? (
                            <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                          ) : (
                            <Check className="w-3 h-3 text-primary-foreground/70" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {remoteTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input - Fixed at bottom */}
        <div className="border-t border-border bg-card px-3 py-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2 items-end"
          >
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleInputChangeWithTyping}
              className="touch-manipulation min-h-[44px] text-base rounded-full px-4"
              autoComplete="off"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!newMessage.trim()}
              className="touch-manipulation h-11 w-11 rounded-full shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Mobile: Conversations list
  if (isMobile) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="px-4 py-4 flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/guest-portal')}
              className="touch-manipulation"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-foreground text-lg">Help Desk</h1>
          </div>
        </header>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">You'll be able to chat with folder owners here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => (
                <button
                  key={conv.member_id}
                  onClick={() => handleSelectMember(conv.member_id)}
                  className="w-full p-4 text-left hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{conv.member_name}</p>
                      {conv.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {conv.last_message || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop layout
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
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full animate-pulse">
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

          {/* Messages - Desktop */}
          <Card className="md:col-span-2 flex flex-col">
            {selectedMember ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {selectedConversation?.member_name}
                    </CardTitle>
                    {remoteTyping && <TypingIndicator compact />}
                  </div>
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
                              transition={{ duration: 0.15 }}
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
                                <div className={`flex items-center gap-1 mt-1 ${
                                  msg.sender_type === 'guest' ? 'justify-end' : ''
                                }`}>
                                  <p
                                    className={`text-xs ${
                                      msg.sender_type === 'guest'
                                        ? 'text-primary-foreground/70'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {formatTime(msg.created_at)}
                                  </p>
                                  {msg.sender_type === 'guest' && (
                                    msg.is_read ? (
                                      <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                                    ) : (
                                      <Check className="w-3 h-3 text-primary-foreground/70" />
                                    )
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                      {remoteTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          <div className="bg-muted rounded-lg px-4 py-3">
                            <TypingIndicator />
                          </div>
                        </motion.div>
                      )}
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
                        ref={inputRef}
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={handleInputChangeWithTyping}
                      />
                      <Button type="submit" disabled={!newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GuestHelpDesk;

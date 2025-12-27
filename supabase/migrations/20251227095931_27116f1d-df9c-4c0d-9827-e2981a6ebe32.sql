-- Create guest_messages table for help desk communication
CREATE TABLE public.guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guest_users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL, -- The member (seller) this message is for
  sender_type text NOT NULL CHECK (sender_type IN ('guest', 'member')),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create member_notifications table
CREATE TABLE public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  type text NOT NULL, -- 'new_guest', 'new_message', etc.
  title text NOT NULL,
  message text,
  related_guest_id uuid REFERENCES public.guest_users(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;

-- RLS for guest_messages
CREATE POLICY "Members can view messages to them" ON public.guest_messages
FOR SELECT USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Members can send messages" ON public.guest_messages
FOR INSERT WITH CHECK (member_id = auth.uid() AND sender_type = 'member');

CREATE POLICY "Allow guest messages insert" ON public.guest_messages
FOR INSERT WITH CHECK (sender_type = 'guest');

CREATE POLICY "Members can update read status" ON public.guest_messages
FOR UPDATE USING (member_id = auth.uid());

-- RLS for member_notifications
CREATE POLICY "Members can view own notifications" ON public.member_notifications
FOR SELECT USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System can create notifications" ON public.member_notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Members can update own notifications" ON public.member_notifications
FOR UPDATE USING (member_id = auth.uid());

CREATE POLICY "Members can delete own notifications" ON public.member_notifications
FOR DELETE USING (member_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_guest_messages_member ON public.guest_messages(member_id);
CREATE INDEX idx_guest_messages_guest ON public.guest_messages(guest_id);
CREATE INDEX idx_member_notifications_member ON public.member_notifications(member_id);
CREATE INDEX idx_member_notifications_unread ON public.member_notifications(member_id, is_read) WHERE is_read = false;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_notifications;
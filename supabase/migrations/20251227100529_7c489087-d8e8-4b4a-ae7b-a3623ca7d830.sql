-- Create owner_member_messages table for owner-member communication
CREATE TABLE public.owner_member_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  member_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'member')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.owner_member_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Owners can view all messages"
ON public.owner_member_messages
FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can send messages"
ON public.owner_member_messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) AND sender_type = 'owner');

CREATE POLICY "Members can view their messages"
ON public.owner_member_messages
FOR SELECT
USING (member_id = auth.uid());

CREATE POLICY "Members can send messages"
ON public.owner_member_messages
FOR INSERT
WITH CHECK (member_id = auth.uid() AND sender_type = 'member');

CREATE POLICY "Owners can update read status"
ON public.owner_member_messages
FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Members can update read status"
ON public.owner_member_messages
FOR UPDATE
USING (member_id = auth.uid());

-- Index for faster queries
CREATE INDEX idx_owner_member_messages_member ON public.owner_member_messages(member_id);
CREATE INDEX idx_owner_member_messages_created ON public.owner_member_messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.owner_member_messages;
-- Create typing_indicators table for real-time typing status
CREATE TABLE public.typing_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chat_type text NOT NULL CHECK (chat_type IN ('guest_member', 'owner_member')),
  target_id uuid NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint for one typing status per user-chat combination
CREATE UNIQUE INDEX typing_indicators_unique_idx ON public.typing_indicators(user_id, chat_type, target_id);

-- Enable RLS
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Allow anyone authenticated to view typing indicators
CREATE POLICY "Anyone can view typing indicators"
ON public.typing_indicators FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow users to manage their own typing indicators
CREATE POLICY "Users can manage own typing indicators"
ON public.typing_indicators FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Add read_at column to guest_messages for read receipts
ALTER TABLE public.guest_messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Add read_at column to owner_member_messages for read receipts
ALTER TABLE public.owner_member_messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Create function to update read_at timestamp when is_read is set to true
CREATE OR REPLACE FUNCTION public.update_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for read receipts
CREATE TRIGGER update_guest_messages_read_at
BEFORE UPDATE ON public.guest_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_read_at();

CREATE TRIGGER update_owner_member_messages_read_at
BEFORE UPDATE ON public.owner_member_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_read_at();
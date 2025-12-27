-- Create API tokens table for Telegram bot authentication
CREATE TABLE public.api_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL, -- First 8 chars of token for identification
  name TEXT NOT NULL DEFAULT 'Telegram Bot',
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on token_hash for fast lookups
CREATE UNIQUE INDEX idx_api_tokens_hash ON public.api_tokens(token_hash);

-- Create index on user_id for user token listing
CREATE INDEX idx_api_tokens_user_id ON public.api_tokens(user_id);

-- Enable RLS
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens (without hash)
CREATE POLICY "Users can view own tokens"
ON public.api_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own tokens
CREATE POLICY "Users can create own tokens"
ON public.api_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens (deactivate, rename)
CREATE POLICY "Users can update own tokens"
ON public.api_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
ON public.api_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Owners can manage all tokens
CREATE POLICY "Owners can manage all tokens"
ON public.api_tokens
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_api_tokens_updated_at
BEFORE UPDATE ON public.api_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
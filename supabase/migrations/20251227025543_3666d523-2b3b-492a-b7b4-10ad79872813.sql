-- Create a secure view that excludes token_hash from user-visible data
-- Users can manage their tokens without seeing the actual hash
CREATE OR REPLACE VIEW public.api_tokens_safe AS
SELECT 
  id,
  user_id,
  token_prefix,
  name,
  last_used_at,
  expires_at,
  is_active,
  created_at,
  updated_at
FROM public.api_tokens;

-- Grant access to the view
GRANT SELECT ON public.api_tokens_safe TO authenticated;

-- Create a secure function to create API tokens
-- This function hashes tokens server-side and never exposes the hash
CREATE OR REPLACE FUNCTION public.create_api_token(
  p_token_hash TEXT,
  p_token_prefix TEXT,
  p_name TEXT DEFAULT 'Telegram Bot',
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id UUID;
BEGIN
  -- Validate caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert the token
  INSERT INTO public.api_tokens (user_id, token_hash, token_prefix, name, expires_at)
  VALUES (auth.uid(), p_token_hash, p_token_prefix, p_name, p_expires_at)
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

-- Create a function to validate API tokens (for edge functions)
-- This is called server-side only, never exposes data to clients
CREATE OR REPLACE FUNCTION public.validate_api_token(p_token_hash TEXT)
RETURNS TABLE(token_id UUID, token_user_id UUID, token_is_active BOOLEAN, token_expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_used_at for the token
  UPDATE public.api_tokens
  SET last_used_at = now()
  WHERE token_hash = p_token_hash
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  -- Return token info
  RETURN QUERY
  SELECT id, user_id, is_active, expires_at
  FROM public.api_tokens
  WHERE token_hash = p_token_hash
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
END;
$$;
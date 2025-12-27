-- Add restrictive policy to explicitly deny anonymous access to profiles
CREATE POLICY "deny_anonymous_access"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add restrictive policy to explicitly deny anonymous access to api_tokens
CREATE POLICY "deny_anonymous_access"
ON public.api_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL);
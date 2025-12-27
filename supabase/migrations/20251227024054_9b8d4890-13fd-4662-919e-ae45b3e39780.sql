-- Add restrictive policy to block anonymous access to profiles
-- This works alongside existing permissive policies to ensure only authenticated users can access data
CREATE POLICY "require_authentication_for_profiles" 
ON public.profiles 
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);
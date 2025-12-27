-- Remove overly permissive policies that allow any authenticated user to read all records
-- The existing restrictive policies already properly limit access to own records and admin/owner access

DROP POLICY IF EXISTS "deny_anonymous_access" ON public.api_tokens;
DROP POLICY IF EXISTS "deny_anonymous_access" ON public.profiles;
-- Drop the overly permissive public policy that allows browsing all active links
DROP POLICY IF EXISTS "Public can view active links by short_code" ON public.shared_links;
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Allow guest registration" ON public.guest_users;

-- Create a truly permissive policy for guest registration
CREATE POLICY "Allow guest registration" 
ON public.guest_users 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also ensure guest_folder_access allows inserts from anon users during registration
DROP POLICY IF EXISTS "Members can create guest access" ON public.guest_folder_access;

CREATE POLICY "Allow guest access creation during registration" 
ON public.guest_folder_access 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);
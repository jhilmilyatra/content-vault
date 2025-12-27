-- Drop existing policy
DROP POLICY IF EXISTS "Allow guest registration" ON public.guest_users;

-- Create permissive policy for guest registration (PERMISSIVE is default, but explicitly stating)
CREATE POLICY "Allow guest registration" 
ON public.guest_users 
AS PERMISSIVE
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Also fix guest_folder_access policy
DROP POLICY IF EXISTS "Allow guest access creation during registration" ON public.guest_folder_access;

CREATE POLICY "Allow guest access creation during registration" 
ON public.guest_folder_access 
AS PERMISSIVE
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);
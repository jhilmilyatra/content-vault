-- Create guest_users table (separate from regular auth users)
CREATE TABLE public.guest_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_banned boolean NOT NULL DEFAULT false,
  banned_at timestamp with time zone,
  banned_by uuid,
  ban_reason text
);

-- Create folder_shares table (tracks which folders are shared for guest access)
CREATE TABLE public.folder_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  member_id uuid NOT NULL, -- The cloud member who shared the folder
  share_code text NOT NULL UNIQUE, -- Unique code for the share link
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create guest_folder_access table (tracks which guests have access to which folders)
CREATE TABLE public.guest_folder_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guest_users(id) ON DELETE CASCADE,
  folder_share_id uuid NOT NULL REFERENCES public.folder_shares(id) ON DELETE CASCADE,
  member_id uuid NOT NULL, -- The member who owns the folder
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  is_restricted boolean NOT NULL DEFAULT false,
  restricted_at timestamp with time zone,
  restricted_by uuid,
  UNIQUE(guest_id, folder_share_id)
);

-- Enable RLS
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_folder_access ENABLE ROW LEVEL SECURITY;

-- RLS for guest_users: members can view their guests, owners can view all
CREATE POLICY "Members can view their guests" ON public.guest_users
FOR SELECT USING (
  id IN (
    SELECT gfa.guest_id FROM public.guest_folder_access gfa
    WHERE gfa.member_id = auth.uid()
  )
  OR has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Allow guest registration" ON public.guest_users
FOR INSERT WITH CHECK (true);

CREATE POLICY "Members can update their guests" ON public.guest_users
FOR UPDATE USING (
  id IN (
    SELECT gfa.guest_id FROM public.guest_folder_access gfa
    WHERE gfa.member_id = auth.uid()
  )
  OR has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Owners can delete guests" ON public.guest_users
FOR DELETE USING (has_role(auth.uid(), 'owner'::app_role));

-- RLS for folder_shares: members can manage their own shares
CREATE POLICY "Members can view own folder shares" ON public.folder_shares
FOR SELECT USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Members can create folder shares" ON public.folder_shares
FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY "Members can update own folder shares" ON public.folder_shares
FOR UPDATE USING (member_id = auth.uid());

CREATE POLICY "Members can delete own folder shares" ON public.folder_shares
FOR DELETE USING (member_id = auth.uid());

CREATE POLICY "Public can view active shares for registration" ON public.folder_shares
FOR SELECT USING (is_active = true);

-- RLS for guest_folder_access: members can manage access to their folders
CREATE POLICY "Members can view guest access to their folders" ON public.guest_folder_access
FOR SELECT USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Members can create guest access" ON public.guest_folder_access
FOR INSERT WITH CHECK (member_id = auth.uid() OR true);

CREATE POLICY "Members can update guest access" ON public.guest_folder_access
FOR UPDATE USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Members can delete guest access" ON public.guest_folder_access
FOR DELETE USING (member_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role));

-- Add indexes for performance
CREATE INDEX idx_folder_shares_code ON public.folder_shares(share_code);
CREATE INDEX idx_folder_shares_member ON public.folder_shares(member_id);
CREATE INDEX idx_guest_folder_access_guest ON public.guest_folder_access(guest_id);
CREATE INDEX idx_guest_folder_access_member ON public.guest_folder_access(member_id);

-- Trigger for updated_at
CREATE TRIGGER update_guest_users_updated_at
  BEFORE UPDATE ON public.guest_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folder_shares_updated_at
  BEFORE UPDATE ON public.folder_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
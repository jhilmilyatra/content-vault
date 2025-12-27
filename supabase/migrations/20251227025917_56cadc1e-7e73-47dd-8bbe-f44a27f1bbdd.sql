-- Create admin_permissions table to control what admins can do
CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  can_view_emails BOOLEAN NOT NULL DEFAULT false,
  can_suspend_users BOOLEAN NOT NULL DEFAULT true,
  can_view_reports BOOLEAN NOT NULL DEFAULT true,
  can_resolve_reports BOOLEAN NOT NULL DEFAULT true,
  can_view_files BOOLEAN NOT NULL DEFAULT false,
  can_delete_files BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Owners can manage all admin permissions
CREATE POLICY "Owners can manage all admin permissions" 
ON public.admin_permissions 
FOR ALL 
USING (has_role(auth.uid(), 'owner'::app_role));

-- Admins can view their own permissions
CREATE POLICY "Admins can view own permissions" 
ON public.admin_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to check admin permission
CREATE OR REPLACE FUNCTION public.admin_has_permission(
  _user_id UUID,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Owners have all permissions
  IF has_role(_user_id, 'owner'::app_role) THEN
    RETURN true;
  END IF;

  -- Check if user is admin
  IF NOT has_role(_user_id, 'admin'::app_role) THEN
    RETURN false;
  END IF;

  -- Check specific permission
  EXECUTE format(
    'SELECT COALESCE(%I, false) FROM public.admin_permissions WHERE user_id = $1',
    _permission
  ) INTO v_has_permission USING _user_id;

  RETURN COALESCE(v_has_permission, false);
END;
$$;

-- Update profiles RLS policy for viewing emails based on permission
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles for moderation" ON public.profiles;

-- Create new policy that checks email permission
CREATE POLICY "Admins can view profiles with permission" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'owner'::app_role) OR
  (has_role(auth.uid(), 'admin'::app_role) AND admin_has_permission(auth.uid(), 'can_view_emails'))
);

-- Create policy for admins to view basic profile info (without email check)
CREATE POLICY "Admins can view basic profile info"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert audit log for permission changes
CREATE OR REPLACE FUNCTION public.log_admin_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    entity_type,
    action,
    actor_id,
    target_user_id,
    entity_id,
    details
  ) VALUES (
    'admin_permissions',
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'permissions_granted'
      WHEN TG_OP = 'UPDATE' THEN 'permissions_updated'
      WHEN TG_OP = 'DELETE' THEN 'permissions_revoked'
    END,
    auth.uid(),
    NEW.user_id,
    NEW.id,
    jsonb_build_object(
      'can_view_emails', NEW.can_view_emails,
      'can_suspend_users', NEW.can_suspend_users,
      'can_view_reports', NEW.can_view_reports,
      'can_resolve_reports', NEW.can_resolve_reports,
      'can_view_files', NEW.can_view_files,
      'can_delete_files', NEW.can_delete_files
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_admin_permission_changes
AFTER INSERT OR UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_permission_change();
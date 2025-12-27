-- Create a security definer function to get owner user id
-- This allows members to find the owner without exposing the user_roles table
CREATE OR REPLACE FUNCTION public.get_owner_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.user_roles
  WHERE role = 'owner'
  LIMIT 1
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_owner_user_id() TO authenticated;

-- Create trigger to auto-create notifications when guests send messages
CREATE OR REPLACE FUNCTION public.notify_member_on_guest_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'guest' THEN
    INSERT INTO public.member_notifications (
      member_id,
      type,
      title,
      message,
      related_guest_id
    )
    SELECT 
      NEW.member_id,
      'new_message',
      'New message from guest',
      LEFT(NEW.message, 100),
      NEW.guest_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for guest messages
DROP TRIGGER IF EXISTS on_guest_message_notify ON public.guest_messages;
CREATE TRIGGER on_guest_message_notify
  AFTER INSERT ON public.guest_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_on_guest_message();

-- Create trigger to auto-create notifications when owner sends messages to members
CREATE OR REPLACE FUNCTION public.notify_member_on_owner_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'owner' THEN
    INSERT INTO public.member_notifications (
      member_id,
      type,
      title,
      message
    )
    VALUES (
      NEW.member_id,
      'new_message',
      'New message from Owner',
      LEFT(NEW.message, 100)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for owner messages
DROP TRIGGER IF EXISTS on_owner_message_notify ON public.owner_member_messages;
CREATE TRIGGER on_owner_message_notify
  AFTER INSERT ON public.owner_member_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_on_owner_message();

-- Create trigger for new guest registration notification
CREATE OR REPLACE FUNCTION public.notify_member_on_new_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_email TEXT;
  guest_name TEXT;
BEGIN
  -- Get guest info
  SELECT email, full_name INTO guest_email, guest_name
  FROM public.guest_users
  WHERE id = NEW.guest_id;

  INSERT INTO public.member_notifications (
    member_id,
    type,
    title,
    message,
    related_guest_id
  )
  VALUES (
    NEW.member_id,
    'new_guest',
    'New guest registered',
    COALESCE(guest_name, guest_email) || ' joined via your share link',
    NEW.guest_id
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for new guest access
DROP TRIGGER IF EXISTS on_guest_access_notify ON public.guest_folder_access;
CREATE TRIGGER on_guest_access_notify
  AFTER INSERT ON public.guest_folder_access
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_member_on_new_guest();
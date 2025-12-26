-- Update the handle_new_user_subscription function to give 1GB for 7 days
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (
    user_id, 
    plan, 
    storage_limit_gb, 
    bandwidth_limit_gb, 
    max_active_links,
    valid_until,
    is_active
  )
  VALUES (
    NEW.id, 
    'free', 
    1,  -- 1GB demo storage
    10, -- 10GB bandwidth for demo
    5,  -- 5 active links for demo
    now() + interval '7 days', -- Valid for 7 days
    true
  );
  
  INSERT INTO public.usage_metrics (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create function to check and suspend expired demo accounts
CREATE OR REPLACE FUNCTION public.check_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user RECORD;
BEGIN
  -- Find all expired free tier subscriptions
  FOR expired_user IN 
    SELECT s.user_id, s.id as subscription_id
    FROM public.subscriptions s
    JOIN public.profiles p ON p.user_id = s.user_id
    WHERE s.plan = 'free'
      AND s.valid_until IS NOT NULL
      AND s.valid_until < now()
      AND s.is_active = true
      AND p.is_suspended = false
  LOOP
    -- Deactivate subscription
    UPDATE public.subscriptions 
    SET is_active = false
    WHERE id = expired_user.subscription_id;
    
    -- Suspend the user profile
    UPDATE public.profiles
    SET 
      is_suspended = true,
      suspended_at = now(),
      suspension_reason = 'Demo period expired. Please upgrade to continue using the service.'
    WHERE user_id = expired_user.user_id;
    
    -- Log the action
    INSERT INTO public.audit_logs (
      entity_type, 
      action, 
      target_user_id, 
      details
    )
    VALUES (
      'subscription',
      'demo_expired_suspension',
      expired_user.user_id,
      jsonb_build_object('reason', 'Demo period expired automatically')
    );
  END LOOP;
END;
$$;

-- Create a cron-like trigger to check on login (alternative to pg_cron)
CREATE OR REPLACE FUNCTION public.check_user_subscription_on_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_record RECORD;
BEGIN
  -- Check if user's subscription is expired
  SELECT * INTO sub_record
  FROM public.subscriptions
  WHERE user_id = NEW.user_id
    AND plan = 'free'
    AND valid_until IS NOT NULL
    AND valid_until < now()
    AND is_active = true
  LIMIT 1;
  
  IF FOUND THEN
    -- Deactivate subscription
    UPDATE public.subscriptions 
    SET is_active = false
    WHERE user_id = NEW.user_id AND plan = 'free';
    
    -- Suspend the user
    UPDATE public.profiles
    SET 
      is_suspended = true,
      suspended_at = now(),
      suspension_reason = 'Demo period expired. Please upgrade to continue using the service.'
    WHERE user_id = NEW.user_id AND is_suspended = false;
  END IF;
  
  RETURN NEW;
END;
$$;
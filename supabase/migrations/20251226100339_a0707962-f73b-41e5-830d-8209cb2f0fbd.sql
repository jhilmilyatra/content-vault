-- Create subscription plans enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'premium', 'lifetime');

-- Create subscriptions table for premium/storage grants
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  storage_limit_gb INTEGER NOT NULL DEFAULT 5,
  bandwidth_limit_gb INTEGER NOT NULL DEFAULT 50,
  max_active_links INTEGER NOT NULL DEFAULT 10,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create manual overrides table for tracking owner actions
CREATE TABLE public.manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  override_type TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create usage metrics table
CREATE TABLE public.usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  bandwidth_used_bytes BIGINT NOT NULL DEFAULT 0,
  active_links_count INTEGER NOT NULL DEFAULT 0,
  total_downloads INTEGER NOT NULL DEFAULT 0,
  total_views INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Subscriptions RLS
CREATE POLICY "Users can view own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all subscriptions"
ON public.subscriptions FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage all subscriptions"
ON public.subscriptions FOR ALL
USING (public.has_role(auth.uid(), 'owner'));

-- Manual overrides RLS
CREATE POLICY "Owners can view all overrides"
ON public.manual_overrides FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can create overrides"
ON public.manual_overrides FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Usage metrics RLS
CREATE POLICY "Users can view own metrics"
ON public.usage_metrics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all metrics"
ON public.usage_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can manage all metrics"
ON public.usage_metrics FOR ALL
USING (public.has_role(auth.uid(), 'owner'));

-- Audit logs RLS (append-only, owners can read)
CREATE POLICY "Owners can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Function to create subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, storage_limit_gb, bandwidth_limit_gb, max_active_links)
  VALUES (NEW.id, 'free', 5, 50, 10);
  
  INSERT INTO public.usage_metrics (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger for subscription creation
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Update timestamps triggers
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_metrics_updated_at
  BEFORE UPDATE ON public.usage_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
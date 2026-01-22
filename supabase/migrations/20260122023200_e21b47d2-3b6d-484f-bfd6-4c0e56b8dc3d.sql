-- Create system_settings table for storing admin-configurable settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only owners can manage settings
CREATE POLICY "Owners can manage all settings"
  ON public.system_settings FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Admins can view settings
CREATE POLICY "Admins can view settings"
  ON public.system_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone authenticated can read telegram settings (for redirect functionality)
CREATE POLICY "Authenticated users can read telegram settings"
  ON public.system_settings FOR SELECT
  USING (auth.uid() IS NOT NULL AND category = 'telegram');

-- Insert default Telegram redirect settings
INSERT INTO public.system_settings (key, value, description, category) VALUES
  ('telegram_premium_link', 'https://t.me/premium', 'Telegram Premium subscription redirect URL', 'telegram'),
  ('telegram_bot_link', 'https://t.me/CloudVaultBot', 'Telegram Bot link for uploads', 'telegram'),
  ('telegram_channel_link', 'https://t.me/cloudvault', 'Main Telegram channel link', 'telegram'),
  ('telegram_support_link', 'https://t.me/cloudvaultsupport', 'Telegram support contact link', 'telegram')
ON CONFLICT (key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
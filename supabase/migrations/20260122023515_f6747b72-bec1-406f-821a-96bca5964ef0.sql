-- Insert Branding settings
INSERT INTO public.system_settings (key, value, category, description) VALUES
  ('app_name', 'CloudVault', 'branding', 'Application display name'),
  ('app_tagline', 'Secure Cloud Storage', 'branding', 'Application tagline/slogan'),
  ('primary_color', '#0ea5e9', 'branding', 'Primary brand color (hex)'),
  ('accent_color', '#8b5cf6', 'branding', 'Accent brand color (hex)'),
  ('logo_url', '', 'branding', 'Custom logo URL (leave empty for default)'),
  ('favicon_url', '', 'branding', 'Custom favicon URL'),
  ('footer_text', '© 2024 CloudVault. All rights reserved.', 'branding', 'Footer copyright text')
ON CONFLICT (key) DO NOTHING;

-- Insert Email Template settings
INSERT INTO public.system_settings (key, value, category, description) VALUES
  ('email_welcome_subject', 'Welcome to CloudVault!', 'email', 'Welcome email subject line'),
  ('email_welcome_body', 'Thank you for joining CloudVault. Get started by uploading your first file.', 'email', 'Welcome email body template'),
  ('email_password_reset_subject', 'Reset Your Password', 'email', 'Password reset email subject'),
  ('email_share_notification_subject', 'Someone shared a file with you', 'email', 'Share notification email subject'),
  ('email_share_notification_body', 'A file has been shared with you on CloudVault.', 'email', 'Share notification email body'),
  ('email_expiry_warning_subject', 'Your subscription is expiring soon', 'email', 'Subscription expiry warning subject'),
  ('email_sender_name', 'CloudVault', 'email', 'Email sender display name'),
  ('email_sender_address', 'noreply@cloudvault.app', 'email', 'Email sender address')
ON CONFLICT (key) DO NOTHING;

-- Insert Feature Flag settings
INSERT INTO public.system_settings (key, value, category, description) VALUES
  ('feature_guest_registration', 'true', 'features', 'Allow guest user registration'),
  ('feature_public_shares', 'true', 'features', 'Allow public share links'),
  ('feature_password_shares', 'true', 'features', 'Allow password-protected shares'),
  ('feature_expiring_links', 'true', 'features', 'Allow expiring share links'),
  ('feature_download_limits', 'true', 'features', 'Allow download limit on shares'),
  ('feature_video_streaming', 'true', 'features', 'Enable video streaming (HLS)'),
  ('feature_telegram_upload', 'true', 'features', 'Enable Telegram bot uploads'),
  ('feature_member_chat', 'true', 'features', 'Enable member-guest chat'),
  ('feature_owner_chat', 'true', 'features', 'Enable owner-member chat'),
  ('feature_analytics', 'true', 'features', 'Enable analytics dashboard'),
  ('maintenance_mode', 'false', 'features', 'Put app in maintenance mode'),
  ('maintenance_message', 'We are performing scheduled maintenance. Please check back soon.', 'features', 'Maintenance mode message')
ON CONFLICT (key) DO NOTHING;
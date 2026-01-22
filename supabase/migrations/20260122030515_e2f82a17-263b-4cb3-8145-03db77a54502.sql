-- Add index for faster feature flag lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_features 
ON system_settings (key, category) 
WHERE category = 'features';

-- Add index for faster video progress lookups (Continue Watching)
CREATE INDEX IF NOT EXISTS idx_video_progress_user_unwatched 
ON video_progress (user_id, last_watched_at DESC) 
WHERE completed = false AND position_seconds > 10;

-- Add index for faster guest video progress lookups
CREATE INDEX IF NOT EXISTS idx_guest_video_progress_unwatched 
ON guest_video_progress (guest_id, last_watched_at DESC) 
WHERE completed = false AND position_seconds > 10;

-- Add index for faster folder queries on dashboard
CREATE INDEX IF NOT EXISTS idx_folders_user_updated 
ON folders (user_id, updated_at DESC);

-- Add index for faster usage metrics lookup
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user 
ON usage_metrics (user_id);
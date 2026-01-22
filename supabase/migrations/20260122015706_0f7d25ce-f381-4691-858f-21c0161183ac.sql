-- Create video progress table for resume functionality
CREATE TABLE public.video_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  progress_percent REAL GENERATED ALWAYS AS (
    CASE WHEN duration_seconds > 0 THEN (position_seconds / duration_seconds) * 100 ELSE 0 END
  ) STORED,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, file_id)
);

-- Enable RLS
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

-- Users can manage their own video progress
CREATE POLICY "Users can view own video progress"
  ON public.video_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video progress"
  ON public.video_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video progress"
  ON public.video_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own video progress"
  ON public.video_progress FOR DELETE
  USING (auth.uid() = user_id);

-- Owners can view all progress for analytics
CREATE POLICY "Owners can view all video progress"
  ON public.video_progress FOR SELECT
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_video_progress_updated_at
  BEFORE UPDATE ON public.video_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast lookups
CREATE INDEX idx_video_progress_user_file ON public.video_progress(user_id, file_id);
CREATE INDEX idx_video_progress_last_watched ON public.video_progress(user_id, last_watched_at DESC);

-- Guest video progress table (separate since guests don't have auth.uid)
CREATE TABLE public.guest_video_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID NOT NULL REFERENCES public.guest_users(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL,
  progress_percent REAL GENERATED ALWAYS AS (
    CASE WHEN duration_seconds > 0 THEN (position_seconds / duration_seconds) * 100 ELSE 0 END
  ) STORED,
  completed BOOLEAN NOT NULL DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(guest_id, file_id)
);

-- Enable RLS (managed via edge functions, not direct access)
ALTER TABLE public.guest_video_progress ENABLE ROW LEVEL SECURITY;

-- Allow edge functions to manage guest progress
CREATE POLICY "System can manage guest video progress"
  ON public.guest_video_progress FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_guest_video_progress_updated_at
  BEFORE UPDATE ON public.guest_video_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast lookups
CREATE INDEX idx_guest_video_progress_guest_file ON public.guest_video_progress(guest_id, file_id);
CREATE INDEX idx_guest_video_progress_last_watched ON public.guest_video_progress(guest_id, last_watched_at DESC);
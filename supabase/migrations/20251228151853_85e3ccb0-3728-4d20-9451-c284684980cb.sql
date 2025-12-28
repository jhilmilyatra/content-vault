-- Create table to store chunked upload sessions (replaces in-memory Map)
CREATE TABLE public.chunked_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  total_size BIGINT NOT NULL,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks INTEGER[] NOT NULL DEFAULT '{}',
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS
ALTER TABLE public.chunked_upload_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own upload sessions
CREATE POLICY "Users can manage their own upload sessions"
ON public.chunked_upload_sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_chunked_upload_sessions_upload_id ON public.chunked_upload_sessions(upload_id);
CREATE INDEX idx_chunked_upload_sessions_user_id ON public.chunked_upload_sessions(user_id);

-- Auto-cleanup expired sessions (optional - can be done via cron job)
CREATE INDEX idx_chunked_upload_sessions_expires_at ON public.chunked_upload_sessions(expires_at);
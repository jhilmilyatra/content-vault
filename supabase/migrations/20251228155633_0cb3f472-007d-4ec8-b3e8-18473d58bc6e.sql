-- Create file_views table to track individual file views with IP
CREATE TABLE public.file_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID, -- NULL for guest views
  guest_id UUID REFERENCES public.guest_users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  view_type TEXT NOT NULL DEFAULT 'preview', -- 'preview', 'download', 'stream'
  bytes_transferred BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_file_views_file_id ON public.file_views(file_id);
CREATE INDEX idx_file_views_user_id ON public.file_views(user_id);
CREATE INDEX idx_file_views_guest_id ON public.file_views(guest_id);
CREATE INDEX idx_file_views_created_at ON public.file_views(created_at);
CREATE INDEX idx_file_views_ip ON public.file_views(ip_address);

-- Enable RLS
ALTER TABLE public.file_views ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own file views"
  ON public.file_views FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "System can insert file views"
  ON public.file_views FOR INSERT
  WITH CHECK (true);

-- Function to record file view and update metrics
CREATE OR REPLACE FUNCTION public.record_file_view(
  p_file_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_guest_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_view_type TEXT DEFAULT 'preview',
  p_bytes_transferred BIGINT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_view_id UUID;
  v_file_user_id UUID;
  v_file_size BIGINT;
BEGIN
  -- Get file owner and size
  SELECT user_id, size_bytes INTO v_file_user_id, v_file_size
  FROM public.files
  WHERE id = p_file_id AND is_deleted = false;
  
  IF v_file_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Insert view record
  INSERT INTO public.file_views (
    file_id, user_id, guest_id, ip_address, user_agent, view_type, bytes_transferred
  )
  VALUES (
    p_file_id, p_user_id, p_guest_id, 
    CASE WHEN p_ip_address IS NOT NULL THEN p_ip_address::inet ELSE NULL END,
    p_user_agent, p_view_type,
    CASE WHEN p_bytes_transferred > 0 THEN p_bytes_transferred ELSE v_file_size END
  )
  RETURNING id INTO v_view_id;
  
  -- Update usage metrics for file owner
  UPDATE public.usage_metrics
  SET 
    total_views = total_views + CASE WHEN p_view_type = 'preview' OR p_view_type = 'stream' THEN 1 ELSE 0 END,
    total_downloads = total_downloads + CASE WHEN p_view_type = 'download' THEN 1 ELSE 0 END,
    bandwidth_used_bytes = bandwidth_used_bytes + COALESCE(
      CASE WHEN p_bytes_transferred > 0 THEN p_bytes_transferred ELSE v_file_size END, 0
    ),
    updated_at = now()
  WHERE user_id = v_file_user_id;
  
  RETURN v_view_id;
END;
$$;

-- Add realtime for file_views
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_views;
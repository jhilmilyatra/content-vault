-- Create folders table
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Folders RLS policies
CREATE POLICY "Users can view own folders"
ON public.folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders"
ON public.folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders"
ON public.folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders"
ON public.folders FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all folders"
ON public.folders FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

-- Files RLS policies
CREATE POLICY "Users can view own files"
ON public.files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own files"
ON public.files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
ON public.files FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
ON public.files FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all files"
ON public.files FOR SELECT
USING (public.has_role(auth.uid(), 'owner'));

-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-files',
  'user-files',
  false,
  524288000, -- 500MB max file size
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/zip', 'application/x-rar-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*']
);

-- Storage RLS policies
CREATE POLICY "Users can view own files in storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own files in storage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files in storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update user storage metrics
CREATE OR REPLACE FUNCTION public.update_user_storage_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_storage BIGINT;
  file_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
    INTO total_storage, file_count
    FROM public.files
    WHERE user_id = OLD.user_id AND is_deleted = false;
    
    UPDATE public.usage_metrics
    SET storage_used_bytes = total_storage, active_links_count = file_count, updated_at = now()
    WHERE user_id = OLD.user_id;
    
    RETURN OLD;
  ELSE
    SELECT COALESCE(SUM(size_bytes), 0), COUNT(*)
    INTO total_storage, file_count
    FROM public.files
    WHERE user_id = NEW.user_id AND is_deleted = false;
    
    UPDATE public.usage_metrics
    SET storage_used_bytes = total_storage, active_links_count = file_count, updated_at = now()
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger to update storage metrics
CREATE TRIGGER update_storage_on_file_change
  AFTER INSERT OR UPDATE OR DELETE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_user_storage_metrics();

-- Timestamps triggers
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
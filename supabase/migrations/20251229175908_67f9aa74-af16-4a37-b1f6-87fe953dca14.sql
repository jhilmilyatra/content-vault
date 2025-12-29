-- Create normalized upload_chunks table for atomic chunk tracking
CREATE TABLE public.upload_chunks (
  upload_id TEXT NOT NULL,
  chunk_index INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (upload_id, chunk_index)
);

-- Add index for fast progress queries
CREATE INDEX idx_upload_chunks_upload_id ON public.upload_chunks(upload_id);

-- Enable RLS
ALTER TABLE public.upload_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can manage chunks for their own upload sessions
CREATE POLICY "Users can manage their own upload chunks"
ON public.upload_chunks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.chunked_upload_sessions s
    WHERE s.upload_id = upload_chunks.upload_id
    AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chunked_upload_sessions s
    WHERE s.upload_id = upload_chunks.upload_id
    AND s.user_id = auth.uid()
  )
);

-- Function to get upload progress (database-derived, always accurate)
CREATE OR REPLACE FUNCTION public.get_upload_progress(p_upload_id TEXT)
RETURNS TABLE (
  uploaded_count INT,
  total_chunks INT,
  progress FLOAT,
  is_complete BOOLEAN,
  uploaded_indices INT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE((SELECT COUNT(*)::INT FROM public.upload_chunks WHERE upload_id = p_upload_id), 0) as uploaded_count,
    s.total_chunks,
    CASE 
      WHEN s.total_chunks > 0 THEN 
        (COALESCE((SELECT COUNT(*)::FLOAT FROM public.upload_chunks WHERE upload_id = p_upload_id), 0) / s.total_chunks * 100)
      ELSE 0 
    END as progress,
    COALESCE((SELECT COUNT(*)::INT FROM public.upload_chunks WHERE upload_id = p_upload_id), 0) = s.total_chunks as is_complete,
    COALESCE((SELECT ARRAY_AGG(chunk_index ORDER BY chunk_index) FROM public.upload_chunks WHERE upload_id = p_upload_id), ARRAY[]::INT[]) as uploaded_indices
  FROM public.chunked_upload_sessions s
  WHERE s.upload_id = p_upload_id;
END;
$$;

-- Function to record a chunk atomically (idempotent, no race conditions)
CREATE OR REPLACE FUNCTION public.record_chunk_upload(p_upload_id TEXT, p_chunk_index INT)
RETURNS TABLE (
  success BOOLEAN,
  uploaded_count INT,
  total_chunks INT,
  progress FLOAT,
  is_complete BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_chunks INT;
  v_uploaded_count INT;
BEGIN
  -- Atomic insert - ON CONFLICT DO NOTHING makes this idempotent
  INSERT INTO public.upload_chunks (upload_id, chunk_index)
  VALUES (p_upload_id, p_chunk_index)
  ON CONFLICT (upload_id, chunk_index) DO NOTHING;
  
  -- Get current progress (always accurate, database-derived)
  SELECT s.total_chunks INTO v_total_chunks
  FROM public.chunked_upload_sessions s
  WHERE s.upload_id = p_upload_id;
  
  SELECT COUNT(*)::INT INTO v_uploaded_count
  FROM public.upload_chunks
  WHERE upload_id = p_upload_id;
  
  RETURN QUERY SELECT 
    true as success,
    v_uploaded_count as uploaded_count,
    v_total_chunks as total_chunks,
    CASE WHEN v_total_chunks > 0 THEN (v_uploaded_count::FLOAT / v_total_chunks * 100) ELSE 0 END as progress,
    v_uploaded_count = v_total_chunks as is_complete;
END;
$$;

-- Migration function to backfill existing array data to new table
CREATE OR REPLACE FUNCTION public.migrate_upload_chunks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  chunk_idx INT;
BEGIN
  FOR r IN SELECT upload_id, uploaded_chunks FROM public.chunked_upload_sessions WHERE uploaded_chunks IS NOT NULL AND array_length(uploaded_chunks, 1) > 0
  LOOP
    FOREACH chunk_idx IN ARRAY r.uploaded_chunks
    LOOP
      INSERT INTO public.upload_chunks (upload_id, chunk_index)
      VALUES (r.upload_id, chunk_idx)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Run migration for existing data
SELECT public.migrate_upload_chunks();

-- Clean up migration function
DROP FUNCTION public.migrate_upload_chunks();

-- Add cleanup trigger - when upload session is deleted, chunks are auto-deleted via cascade
-- We need to add proper foreign key, but since upload_id is TEXT not UUID, we use a trigger instead
CREATE OR REPLACE FUNCTION public.cleanup_upload_chunks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.upload_chunks WHERE upload_id = OLD.upload_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_cleanup_upload_chunks
BEFORE DELETE ON public.chunked_upload_sessions
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_upload_chunks();
-- Add duration_seconds column to files table for video duration storage
ALTER TABLE public.files 
ADD COLUMN duration_seconds real NULL;

-- Add index for efficient querying of videos by duration
CREATE INDEX idx_files_duration ON public.files (duration_seconds) WHERE duration_seconds IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.files.duration_seconds IS 'Duration of video files in seconds, NULL for non-video files';
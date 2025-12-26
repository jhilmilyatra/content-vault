-- Create shared_links table
CREATE TABLE public.shared_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own shared links"
ON public.shared_links
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shared links"
ON public.shared_links
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared links"
ON public.shared_links
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared links"
ON public.shared_links
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage all shared links"
ON public.shared_links
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role));

-- Public access for verification (read-only, limited fields via edge function)
CREATE POLICY "Public can view active links by short_code"
ON public.shared_links
FOR SELECT
USING (is_active = true);

-- Create index for fast lookups
CREATE INDEX idx_shared_links_short_code ON public.shared_links(short_code);
CREATE INDEX idx_shared_links_file_id ON public.shared_links(file_id);

-- Trigger for updated_at
CREATE TRIGGER update_shared_links_updated_at
BEFORE UPDATE ON public.shared_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
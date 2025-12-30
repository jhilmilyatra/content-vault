-- ============================================================
-- PERFORMANCE OPTIMIZATION - RPC FUNCTIONS
-- Goal: Reduce DB round-trips with optimized single-query functions
-- ============================================================

-- Get user's files in a folder with single query
CREATE OR REPLACE FUNCTION get_folder_contents(
  p_user_id uuid,
  p_folder_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  created_at timestamptz,
  folder_id uuid
) AS $$
  SELECT 
    f.id, f.name, f.original_name, f.mime_type, 
    f.size_bytes, f.storage_path, f.created_at, f.folder_id
  FROM files f
  WHERE f.user_id = p_user_id 
    AND f.is_deleted = false
    AND (p_folder_id IS NULL AND f.folder_id IS NULL OR f.folder_id = p_folder_id)
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Verify share link and get file info in single query
CREATE OR REPLACE FUNCTION verify_share_link_fast(p_short_code text)
RETURNS TABLE(
  link_id uuid,
  file_id uuid,
  user_id uuid,
  is_valid boolean,
  requires_password boolean,
  password_hash text,
  expires_at timestamptz,
  max_downloads int,
  download_count int,
  file_name text,
  file_original_name text,
  file_mime_type text,
  file_size bigint,
  file_storage_path text
) AS $$
  SELECT 
    sl.id as link_id,
    sl.file_id,
    sl.user_id,
    (sl.is_active = true 
      AND (sl.expires_at IS NULL OR sl.expires_at > now())
      AND (sl.max_downloads IS NULL OR sl.download_count < sl.max_downloads)
    ) as is_valid,
    (sl.password_hash IS NOT NULL) as requires_password,
    sl.password_hash,
    sl.expires_at,
    sl.max_downloads,
    sl.download_count,
    f.name as file_name,
    f.original_name as file_original_name,
    f.mime_type as file_mime_type,
    f.size_bytes as file_size,
    f.storage_path as file_storage_path
  FROM shared_links sl
  LEFT JOIN files f ON f.id = sl.file_id AND f.is_deleted = false
  WHERE sl.short_code = p_short_code
    AND sl.is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Get guest's accessible folders with all related data in single query
CREATE OR REPLACE FUNCTION get_guest_folders_fast(
  p_guest_id uuid,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  access_id uuid,
  folder_share_id uuid,
  member_id uuid,
  added_at timestamptz,
  folder_id uuid,
  folder_name text,
  folder_description text,
  member_name text
) AS $$
  SELECT 
    gfa.id as access_id,
    gfa.folder_share_id,
    gfa.member_id,
    gfa.added_at,
    fo.id as folder_id,
    fo.name as folder_name,
    fo.description as folder_description,
    p.full_name as member_name
  FROM guest_folder_access gfa
  JOIN folder_shares fs ON fs.id = gfa.folder_share_id AND fs.is_active = true
  JOIN folders fo ON fo.id = fs.folder_id
  LEFT JOIN profiles p ON p.user_id = gfa.member_id
  WHERE gfa.guest_id = p_guest_id
    AND gfa.is_restricted = false
  ORDER BY gfa.added_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check guest file access (replaces multiple round-trips)
CREATE OR REPLACE FUNCTION check_guest_file_access(
  p_guest_id uuid,
  p_storage_path text
)
RETURNS TABLE(
  has_access boolean,
  file_id uuid,
  file_name text,
  file_original_name text,
  file_mime_type text,
  file_size bigint,
  folder_id uuid
) AS $$
DECLARE
  v_file_record RECORD;
  v_has_access boolean := false;
  v_current_folder_id uuid;
  v_shared_folder_ids uuid[];
BEGIN
  -- Get file info
  SELECT f.id, f.name, f.original_name, f.mime_type, f.size_bytes, f.folder_id
  INTO v_file_record
  FROM files f
  WHERE f.storage_path = p_storage_path AND f.is_deleted = false;
  
  IF v_file_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::bigint, NULL::uuid;
    RETURN;
  END IF;
  
  -- Get all shared folder IDs for this guest
  SELECT array_agg(fs.folder_id)
  INTO v_shared_folder_ids
  FROM guest_folder_access gfa
  JOIN folder_shares fs ON fs.id = gfa.folder_share_id AND fs.is_active = true
  WHERE gfa.guest_id = p_guest_id AND gfa.is_restricted = false;
  
  IF v_shared_folder_ids IS NULL OR array_length(v_shared_folder_ids, 1) IS NULL THEN
    RETURN QUERY SELECT false, v_file_record.id, v_file_record.name, v_file_record.original_name, 
                        v_file_record.mime_type, v_file_record.size_bytes, v_file_record.folder_id;
    RETURN;
  END IF;
  
  -- Check if file's folder is directly shared
  IF v_file_record.folder_id = ANY(v_shared_folder_ids) THEN
    v_has_access := true;
  ELSE
    -- Check parent folders (max 10 levels)
    v_current_folder_id := v_file_record.folder_id;
    FOR i IN 1..10 LOOP
      EXIT WHEN v_current_folder_id IS NULL;
      
      SELECT parent_id INTO v_current_folder_id
      FROM folders WHERE id = v_current_folder_id;
      
      IF v_current_folder_id = ANY(v_shared_folder_ids) THEN
        v_has_access := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT v_has_access, v_file_record.id, v_file_record.name, v_file_record.original_name,
                      v_file_record.mime_type, v_file_record.size_bytes, v_file_record.folder_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Get folder breadcrumbs in single query (uses recursive CTE)
CREATE OR REPLACE FUNCTION get_folder_breadcrumbs(
  p_folder_id uuid,
  p_max_depth int DEFAULT 10
)
RETURNS TABLE(
  depth int,
  folder_id uuid,
  folder_name text,
  parent_id uuid
) AS $$
  WITH RECURSIVE breadcrumb AS (
    SELECT 0 as depth, f.id as folder_id, f.name as folder_name, f.parent_id
    FROM folders f
    WHERE f.id = p_folder_id
    
    UNION ALL
    
    SELECT b.depth + 1, f.id, f.name, f.parent_id
    FROM breadcrumb b
    JOIN folders f ON f.id = b.parent_id
    WHERE b.depth < p_max_depth
  )
  SELECT * FROM breadcrumb ORDER BY depth DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Increment usage metrics atomically (fire-and-forget from edge)
CREATE OR REPLACE FUNCTION increment_usage_metrics(
  p_user_id uuid,
  p_views int DEFAULT 0,
  p_downloads int DEFAULT 0,
  p_bandwidth bigint DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE usage_metrics SET
    total_views = total_views + p_views,
    total_downloads = total_downloads + p_downloads,
    bandwidth_used_bytes = bandwidth_used_bytes + p_bandwidth,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO usage_metrics (user_id, total_views, total_downloads, bandwidth_used_bytes)
    VALUES (p_user_id, p_views, p_downloads, p_bandwidth);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PERFORMANCE INDEXES (non-concurrent for transaction compatibility)
-- ============================================================

-- Files: Most common query pattern - user's active files
CREATE INDEX IF NOT EXISTS idx_files_user_active
ON files (user_id, created_at DESC)
WHERE is_deleted = false;

-- Files: Lookup by storage_path (guest file access)
CREATE INDEX IF NOT EXISTS idx_files_storage_path_active
ON files (storage_path)
WHERE is_deleted = false;

-- Folders: User's folders
CREATE INDEX IF NOT EXISTS idx_folders_user
ON folders (user_id);

-- Folders: Parent lookup for breadcrumbs
CREATE INDEX IF NOT EXISTS idx_folders_parent
ON folders (parent_id);

-- Shared links: Active link lookup by short_code
CREATE INDEX IF NOT EXISTS idx_shared_links_active
ON shared_links (short_code)
WHERE is_active = true;

-- Guest folder access: Guest's accessible folders
CREATE INDEX IF NOT EXISTS idx_guest_access_guest
ON guest_folder_access (guest_id)
WHERE is_restricted = false;

-- Folder shares: Active shares
CREATE INDEX IF NOT EXISTS idx_folder_shares_active
ON folder_shares (folder_id)
WHERE is_active = true;

-- File views: Recent views by file
CREATE INDEX IF NOT EXISTS idx_file_views_file_recent
ON file_views (file_id, created_at DESC);

-- Usage metrics: User lookup
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user
ON usage_metrics (user_id);

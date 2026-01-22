-- Drop and recreate check_guest_file_access with duration_seconds
DROP FUNCTION IF EXISTS check_guest_file_access(uuid, text);

CREATE FUNCTION check_guest_file_access(
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
  folder_id uuid,
  duration_seconds real
) AS $$
DECLARE
  v_file_record RECORD;
  v_has_access boolean := false;
  v_current_folder_id uuid;
  v_shared_folder_ids uuid[];
BEGIN
  -- Get file info including duration_seconds
  SELECT f.id, f.name, f.original_name, f.mime_type, f.size_bytes, f.folder_id, f.duration_seconds
  INTO v_file_record
  FROM files f
  WHERE f.storage_path = p_storage_path AND f.is_deleted = false;
  
  IF v_file_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::bigint, NULL::uuid, NULL::real;
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
                        v_file_record.mime_type, v_file_record.size_bytes, v_file_record.folder_id, v_file_record.duration_seconds;
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
                      v_file_record.mime_type, v_file_record.size_bytes, v_file_record.folder_id, v_file_record.duration_seconds;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
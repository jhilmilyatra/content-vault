-- Performance indexes for common queries

-- Files table indexes
CREATE INDEX IF NOT EXISTS idx_files_user_folder_deleted ON public.files (user_id, folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files (folder_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_files_user_deleted ON public.files (user_id, is_deleted);

-- Folders table indexes  
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON public.folders (user_id, parent_id);

-- Guest messages indexes for chat performance
CREATE INDEX IF NOT EXISTS idx_guest_messages_member_guest ON public.guest_messages (member_id, guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_messages_guest_member_read ON public.guest_messages (guest_id, member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_guest_messages_created ON public.guest_messages (created_at DESC);

-- Owner member messages indexes
CREATE INDEX IF NOT EXISTS idx_owner_member_messages_member ON public.owner_member_messages (member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_owner_member_messages_created ON public.owner_member_messages (created_at DESC);

-- Shared links index for lookups
CREATE INDEX IF NOT EXISTS idx_shared_links_short_code ON public.shared_links (short_code) WHERE is_active = true;

-- Guest folder access indexes
CREATE INDEX IF NOT EXISTS idx_guest_folder_access_guest ON public.guest_folder_access (guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_folder_access_member ON public.guest_folder_access (member_id);

-- Folder shares index
CREATE INDEX IF NOT EXISTS idx_folder_shares_member ON public.folder_shares (member_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_folder_shares_code ON public.folder_shares (share_code) WHERE is_active = true;

-- Audit logs index for owner queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

-- Typing indicators index for realtime
CREATE INDEX IF NOT EXISTS idx_typing_indicators_target ON public.typing_indicators (target_id, chat_type);

-- Member notifications index
CREATE INDEX IF NOT EXISTS idx_member_notifications_member_read ON public.member_notifications (member_id, is_read);
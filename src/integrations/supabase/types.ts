export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_delete_files: boolean
          can_resolve_reports: boolean
          can_suspend_users: boolean
          can_view_emails: boolean
          can_view_files: boolean
          can_view_reports: boolean
          created_at: string
          granted_by: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_delete_files?: boolean
          can_resolve_reports?: boolean
          can_suspend_users?: boolean
          can_view_emails?: boolean
          can_view_files?: boolean
          can_view_reports?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_delete_files?: boolean
          can_resolve_reports?: boolean
          can_suspend_users?: boolean
          can_view_emails?: boolean
          can_view_files?: boolean
          can_view_reports?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token_hash: string
          token_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          target_user_id?: string | null
        }
        Relationships: []
      }
      chunked_upload_sessions: {
        Row: {
          created_at: string
          expires_at: string
          file_name: string
          folder_id: string | null
          id: string
          mime_type: string
          total_chunks: number
          total_size: number
          upload_id: string
          uploaded_chunks: number[]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          file_name: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          total_chunks: number
          total_size: number
          upload_id: string
          uploaded_chunks?: number[]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_name?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          total_chunks?: number
          total_size?: number
          upload_id?: string
          uploaded_chunks?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunked_upload_sessions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      file_views: {
        Row: {
          bytes_transferred: number | null
          created_at: string
          file_id: string
          guest_id: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
          view_type: string
        }
        Insert: {
          bytes_transferred?: number | null
          created_at?: string
          file_id: string
          guest_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          view_type?: string
        }
        Update: {
          bytes_transferred?: number | null
          created_at?: string
          file_id?: string
          guest_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_views_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_views_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          folder_id: string | null
          id: string
          is_deleted: boolean
          mime_type: string
          name: string
          original_name: string
          size_bytes: number
          storage_path: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          mime_type: string
          name: string
          original_name: string
          size_bytes: number
          storage_path: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          mime_type?: string
          name?: string
          original_name?: string
          size_bytes?: number
          storage_path?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_shares: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          is_active: boolean
          member_id: string
          share_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          is_active?: boolean
          member_id: string
          share_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          is_active?: boolean
          member_id?: string
          share_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_folder_access: {
        Row: {
          added_at: string
          folder_share_id: string
          guest_id: string
          id: string
          is_restricted: boolean
          member_id: string
          restricted_at: string | null
          restricted_by: string | null
        }
        Insert: {
          added_at?: string
          folder_share_id: string
          guest_id: string
          id?: string
          is_restricted?: boolean
          member_id: string
          restricted_at?: string | null
          restricted_by?: string | null
        }
        Update: {
          added_at?: string
          folder_share_id?: string
          guest_id?: string
          id?: string
          is_restricted?: boolean
          member_id?: string
          restricted_at?: string | null
          restricted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_folder_access_folder_share_id_fkey"
            columns: ["folder_share_id"]
            isOneToOne: false
            referencedRelation: "folder_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_folder_access_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_messages: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          is_read: boolean
          member_id: string
          message: string
          read_at: string | null
          sender_type: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          is_read?: boolean
          member_id: string
          message: string
          read_at?: string | null
          sender_type: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          is_read?: boolean
          member_id?: string
          message?: string
          read_at?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_messages_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_users: {
        Row: {
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_banned: boolean
          password_hash: string
          updated_at: string
        }
        Insert: {
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          password_hash: string
          updated_at?: string
        }
        Update: {
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          password_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_video_progress: {
        Row: {
          completed: boolean
          created_at: string
          duration_seconds: number | null
          file_id: string
          guest_id: string
          id: string
          last_watched_at: string
          position_seconds: number
          progress_percent: number | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_id: string
          guest_id: string
          id?: string
          last_watched_at?: string
          position_seconds?: number
          progress_percent?: number | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_id?: string
          guest_id?: string
          id?: string
          last_watched_at?: string
          position_seconds?: number
          progress_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_video_progress_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_video_progress_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_overrides: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string
          id: string
          new_value: string
          override_type: string
          previous_value: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by: string
          id?: string
          new_value: string
          override_type: string
          previous_value?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          new_value?: string
          override_type?: string
          previous_value?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      member_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          member_id: string
          message: string | null
          related_guest_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          member_id: string
          message?: string | null
          related_guest_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          member_id?: string
          message?: string | null
          related_guest_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_notifications_related_guest_id_fkey"
            columns: ["related_guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_member_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          member_id: string
          message: string
          owner_id: string
          read_at: string | null
          sender_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          member_id: string
          message: string
          owner_id: string
          read_at?: string | null
          sender_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          member_id?: string
          message?: string
          owner_id?: string
          read_at?: string | null
          sender_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_suspended: boolean
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string
          id: string
          report_type: string
          reported_file_id: string | null
          reported_user_id: string | null
          reporter_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          report_type: string
          reported_file_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          report_type?: string
          reported_file_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_file_id_fkey"
            columns: ["reported_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_links: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string | null
          file_id: string
          id: string
          is_active: boolean
          max_downloads: number | null
          password_hash: string | null
          short_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          file_id: string
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          short_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          file_id?: string
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          short_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          bandwidth_limit_gb: number
          created_at: string
          id: string
          is_active: boolean
          max_active_links: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          storage_limit_gb: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          bandwidth_limit_gb?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_active_links?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          storage_limit_gb?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          bandwidth_limit_gb?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_active_links?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          storage_limit_gb?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          chat_type: string
          id: string
          is_typing: boolean
          target_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_type: string
          id?: string
          is_typing?: boolean
          target_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_type?: string
          id?: string
          is_typing?: boolean
          target_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      upload_chunks: {
        Row: {
          chunk_index: number
          created_at: string | null
          upload_id: string
        }
        Insert: {
          chunk_index: number
          created_at?: string | null
          upload_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string | null
          upload_id?: string
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          active_links_count: number
          bandwidth_used_bytes: number
          created_at: string
          id: string
          period_end: string
          period_start: string
          storage_used_bytes: number
          total_downloads: number
          total_views: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_links_count?: number
          bandwidth_used_bytes?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          storage_used_bytes?: number
          total_downloads?: number
          total_views?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_links_count?: number
          bandwidth_used_bytes?: number
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          storage_used_bytes?: number
          total_downloads?: number
          total_views?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_progress: {
        Row: {
          completed: boolean
          created_at: string
          duration_seconds: number | null
          file_id: string
          id: string
          last_watched_at: string
          position_seconds: number
          progress_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_id: string
          id?: string
          last_watched_at?: string
          position_seconds?: number
          progress_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          file_id?: string
          id?: string
          last_watched_at?: string
          position_seconds?: number
          progress_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_tokens_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          token_prefix: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          token_prefix?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          token_prefix?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      check_expired_subscriptions: { Args: never; Returns: undefined }
      check_guest_file_access: {
        Args: { p_guest_id: string; p_storage_path: string }
        Returns: {
          file_id: string
          file_mime_type: string
          file_name: string
          file_original_name: string
          file_size: number
          folder_id: string
          has_access: boolean
        }[]
      }
      create_api_token: {
        Args: {
          p_expires_at?: string
          p_name?: string
          p_token_hash: string
          p_token_prefix: string
        }
        Returns: string
      }
      get_folder_breadcrumbs: {
        Args: { p_folder_id: string; p_max_depth?: number }
        Returns: {
          depth: number
          folder_id: string
          folder_name: string
          parent_id: string
        }[]
      }
      get_folder_contents: {
        Args: {
          p_folder_id?: string
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          created_at: string
          folder_id: string
          id: string
          mime_type: string
          name: string
          original_name: string
          size_bytes: number
          storage_path: string
        }[]
      }
      get_guest_folders_fast: {
        Args: { p_guest_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          access_id: string
          added_at: string
          folder_description: string
          folder_id: string
          folder_name: string
          folder_share_id: string
          member_id: string
          member_name: string
        }[]
      }
      get_owner_user_id: { Args: never; Returns: string }
      get_upload_progress: {
        Args: { p_upload_id: string }
        Returns: {
          is_complete: boolean
          progress: number
          total_chunks: number
          uploaded_count: number
          uploaded_indices: number[]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage_metrics: {
        Args: {
          p_bandwidth?: number
          p_downloads?: number
          p_user_id: string
          p_views?: number
        }
        Returns: undefined
      }
      record_chunk_upload: {
        Args: { p_chunk_index: number; p_upload_id: string }
        Returns: {
          is_complete: boolean
          progress: number
          success: boolean
          total_chunks: number
          uploaded_count: number
        }[]
      }
      record_file_view: {
        Args: {
          p_bytes_transferred?: number
          p_file_id: string
          p_guest_id?: string
          p_ip_address?: string
          p_user_agent?: string
          p_user_id?: string
          p_view_type?: string
        }
        Returns: string
      }
      validate_api_token: {
        Args: { p_token_hash: string }
        Returns: {
          token_expires_at: string
          token_id: string
          token_is_active: boolean
          token_user_id: string
        }[]
      }
      verify_share_link_fast: {
        Args: { p_short_code: string }
        Returns: {
          download_count: number
          expires_at: string
          file_id: string
          file_mime_type: string
          file_name: string
          file_original_name: string
          file_size: number
          file_storage_path: string
          is_valid: boolean
          link_id: string
          max_downloads: number
          password_hash: string
          requires_password: boolean
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
      subscription_plan: "free" | "premium" | "lifetime"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "member"],
      subscription_plan: ["free", "premium", "lifetime"],
    },
  },
} as const

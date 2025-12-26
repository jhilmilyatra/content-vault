import { supabase } from "@/integrations/supabase/client";

export interface FileItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  thumbnail_url: string | null;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export const uploadFile = async (
  file: File,
  userId: string,
  folderId: string | null,
  onProgress?: (progress: number) => void
): Promise<FileItem> => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const storagePath = `${userId}/${fileName}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("user-files")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Create file record
  const { data, error } = await supabase
    .from("files")
    .insert({
      user_id: userId,
      folder_id: folderId,
      name: file.name,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) throw error;

  if (onProgress) onProgress(100);

  return data as FileItem;
};

export const uploadMultipleFiles = async (
  files: File[],
  userId: string,
  folderId: string | null,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<FileItem[]> => {
  const results: FileItem[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadFile(file, userId, folderId, (progress) => {
      if (onProgress) onProgress(i, progress);
    });
    results.push(result);
  }

  return results;
};

export const deleteFile = async (fileId: string, storagePath: string): Promise<void> => {
  // Soft delete in database
  const { error: dbError } = await supabase
    .from("files")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", fileId);

  if (dbError) throw dbError;
};

export const permanentDeleteFile = async (fileId: string, storagePath: string): Promise<void> => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("user-files")
    .remove([storagePath]);

  if (storageError) throw storageError;

  // Delete from database
  const { error: dbError } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId);

  if (dbError) throw dbError;
};

export const restoreFile = async (fileId: string): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ is_deleted: false, deleted_at: null })
    .eq("id", fileId);

  if (error) throw error;
};

export const getFileUrl = async (storagePath: string): Promise<string> => {
  const { data } = await supabase.storage
    .from("user-files")
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (!data?.signedUrl) throw new Error("Failed to get file URL");

  return data.signedUrl;
};

export const createFolder = async (
  userId: string,
  name: string,
  parentId: string | null
): Promise<FolderItem> => {
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: userId,
      name,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) throw error;

  return data as FolderItem;
};

export const renameFolder = async (folderId: string, newName: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .update({ name: newName })
    .eq("id", folderId);

  if (error) throw error;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", folderId);

  if (error) throw error;
};

export const renameFile = async (fileId: string, newName: string): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ name: newName })
    .eq("id", fileId);

  if (error) throw error;
};

export const moveFile = async (fileId: string, newFolderId: string | null): Promise<void> => {
  const { error } = await supabase
    .from("files")
    .update({ folder_id: newFolderId })
    .eq("id", fileId);

  if (error) throw error;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "archive";
  if (mimeType.includes("word") || mimeType.includes("document")) return "document";
  return "file";
};

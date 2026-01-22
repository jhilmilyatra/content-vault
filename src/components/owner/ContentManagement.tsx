import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Trash2, 
  Loader2, 
  HardDrive, 
  Play, 
  Eye, 
  RefreshCw,
  Search,
  Film,
  Image as ImageIcon,
  FileText,
  Shield,
  Zap,
  Radio,
  AlertTriangle,
  Download,
  BarChart3,
  Flame,
  RotateCcw,
  X
} from 'lucide-react';
import { GlassCard, GlassCardHeader } from '@/components/ios/GlassCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCacheStats, clearThumbnailCache } from '@/lib/thumbnailCache';
import { broadcastCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { mediumHaptic, lightHaptic } from '@/lib/haptics';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/media';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FileAnalytics {
  views: number;
  downloads: number;
  bandwidth: number;
}

interface UserFile {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  user_id: string;
  thumbnail_url?: string;
  user_email?: string;
  user_name?: string;
  is_deleted?: boolean;
  analytics?: FileAnalytics;
}

interface CacheStats {
  count: number;
  totalSizeMB: number;
}

const ContentManagement = () => {
  const [localCacheStats, setLocalCacheStats] = useState<CacheStats>({ count: 0, totalSizeMB: 0 });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<UserFile | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [fileToDelete, setFileToDelete] = useState<UserFile | null>(null);
  const [fileToPermanentDelete, setFileToPermanentDelete] = useState<UserFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [permanentDeleting, setPermanentDeleting] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load local cache stats
      const cacheStats = await getCacheStats();
      setLocalCacheStats(cacheStats);

      // Load active files
      const { data: activeFilesData, count: activeCount } = await supabase
        .from('files')
        .select('id, name, original_name, mime_type, size_bytes, storage_path, created_at, user_id, thumbnail_url, is_deleted', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      // Load trashed files
      const { data: trashedFilesData } = await supabase
        .from('files')
        .select('id, name, original_name, mime_type, size_bytes, storage_path, created_at, user_id, thumbnail_url, is_deleted, deleted_at')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })
        .limit(50);

      const allFiles = [...(activeFilesData || []), ...(trashedFilesData || [])];

      if (allFiles.length > 0) {
        // Get user info for each file
        const userIds = [...new Set(allFiles.map(f => f.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Get file analytics (views and downloads)
        const fileIds = allFiles.map(f => f.id);
        const { data: viewsData } = await supabase
          .from('file_views')
          .select('file_id, view_type, bytes_transferred')
          .in('file_id', fileIds);

        // Aggregate analytics per file
        const analyticsMap = new Map<string, FileAnalytics>();
        viewsData?.forEach(view => {
          const current = analyticsMap.get(view.file_id) || { views: 0, downloads: 0, bandwidth: 0 };
          if (view.view_type === 'download') {
            current.downloads++;
          } else {
            current.views++;
          }
          current.bandwidth += view.bytes_transferred || 0;
          analyticsMap.set(view.file_id, current);
        });

        const enrichActiveFiles = (activeFilesData || []).map(file => ({
          ...file,
          user_email: profileMap.get(file.user_id)?.email || 'Unknown',
          user_name: profileMap.get(file.user_id)?.full_name || 'Unknown User',
          analytics: analyticsMap.get(file.id) || { views: 0, downloads: 0, bandwidth: 0 },
        }));

        const enrichTrashedFiles = (trashedFilesData || []).map(file => ({
          ...file,
          user_email: profileMap.get(file.user_id)?.email || 'Unknown',
          user_name: profileMap.get(file.user_id)?.full_name || 'Unknown User',
          analytics: analyticsMap.get(file.id) || { views: 0, downloads: 0, bandwidth: 0 },
        }));

        setFiles(enrichActiveFiles);
        setTrashedFiles(enrichTrashedFiles);
        setTotalFiles(activeCount || 0);

        // Calculate total size of active files
        const totalBytes = (activeFilesData || []).reduce((acc, f) => acc + Number(f.size_bytes), 0);
        setTotalSize(totalBytes);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load content data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllCaches = async () => {
    mediumHaptic();
    setClearing(true);
    try {
      await clearThumbnailCache();
      setLocalCacheStats({ count: 0, totalSizeMB: 0 });
      toast.success('Local cache cleared');
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleBroadcastCacheClear = async () => {
    mediumHaptic();
    setBroadcasting(true);
    try {
      // Clear local cache first
      await clearThumbnailCache();
      setLocalCacheStats({ count: 0, totalSizeMB: 0 });
      
      // Broadcast to all connected clients
      const success = await broadcastCacheInvalidation();
      
      if (success) {
        toast.success('Cache invalidation broadcast sent', {
          description: 'All connected clients will clear their caches.',
        });
      } else {
        toast.warning('Broadcast may not have reached all clients');
      }
    } catch (error) {
      toast.error('Failed to broadcast cache invalidation');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDeleteFile = async (file: UserFile) => {
    setDeleting(true);
    try {
      // Soft delete the file
      const { error } = await supabase
        .from('files')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', file.id);

      if (error) throw error;

      // Move file from active to trash in local state
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setTrashedFiles(prev => [{ ...file, is_deleted: true }, ...prev]);
      setTotalFiles(prev => prev - 1);
      setTotalSize(prev => prev - file.size_bytes);
      
      toast.success('File deleted', {
        description: `${file.original_name} has been moved to trash.`,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(false);
      setFileToDelete(null);
    }
  };

  const handlePermanentDelete = async (file: UserFile) => {
    setPermanentDeleting(true);
    mediumHaptic();
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-delete-file`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileId: file.id,
            storagePath: file.storage_path,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      // Remove from trashed files
      setTrashedFiles(prev => prev.filter(f => f.id !== file.id));
      
      toast.success('Permanently deleted', {
        description: `${file.original_name} has been removed from storage.`,
      });
    } catch (error) {
      console.error('Failed to permanently delete file:', error);
      toast.error('Failed to delete file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setPermanentDeleting(false);
      setFileToPermanentDelete(null);
    }
  };

  const handleRestoreFile = async (file: UserFile) => {
    setRestoring(file.id);
    lightHaptic();
    
    try {
      const { error } = await supabase
        .from('files')
        .update({ 
          is_deleted: false, 
          deleted_at: null 
        })
        .eq('id', file.id);

      if (error) throw error;

      // Move file from trash to active in local state
      setTrashedFiles(prev => prev.filter(f => f.id !== file.id));
      setFiles(prev => [{ ...file, is_deleted: false }, ...prev]);
      setTotalFiles(prev => prev + 1);
      setTotalSize(prev => prev + file.size_bytes);
      
      toast.success('File restored', {
        description: `${file.original_name} has been restored.`,
      });
    } catch (error) {
      console.error('Failed to restore file:', error);
      toast.error('Failed to restore file');
    } finally {
      setRestoring(null);
    }
  };

  const handleStreamFile = async (file: UserFile) => {
    lightHaptic();
    setSelectedFile(file);
    
    // Construct stream URL based on storage type
    const isVps = file.storage_path.startsWith('vps://');
    
    if (isVps) {
      const vpsPath = file.storage_path.replace('vps://', '');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vps-file?path=${encodeURIComponent(vpsPath)}`;
      setStreamUrl(url);
    } else {
      // For Telegram storage, use the storage path directly
      setStreamUrl(file.storage_path);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('video/')) return <Film className="w-4 h-4 text-purple-400" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-teal-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  const displayFiles = viewMode === 'active' ? files : trashedFiles;
  
  const filteredFiles = displayFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Content & Cache Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Stream content and manage system-wide caches
          </p>
        </div>
        <button
          onClick={() => {
            lightHaptic();
            loadData();
          }}
          disabled={loading}
          className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div 
          className="p-4 rounded-2xl ios-glass"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalFiles.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Files</p>
        </motion.div>

        <motion.div 
          className="p-4 rounded-2xl ios-glass"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatSize(totalSize)}</p>
          <p className="text-xs text-muted-foreground">Total Storage</p>
        </motion.div>

        <motion.div 
          className="p-4 rounded-2xl ios-glass"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{localCacheStats.count}</p>
          <p className="text-xs text-muted-foreground">Local Cached</p>
        </motion.div>

        <motion.div 
          className="p-4 rounded-2xl ios-glass"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{localCacheStats.totalSizeMB.toFixed(1)} MB</p>
          <p className="text-xs text-muted-foreground">Cache Size</p>
        </motion.div>
      </div>

      {/* Cache Actions */}
      <GlassCard variant="elevated">
        <GlassCardHeader 
          title="Cache Controls" 
          icon={<Trash2 className="w-5 h-5 text-red-400" />}
        />
        <div className="p-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleClearAllCaches}
              disabled={clearing}
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {clearing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Clear My Cache
            </button>
            
            <button
              onClick={handleBroadcastCacheClear}
              disabled={broadcasting}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 text-amber-400 hover:from-amber-500/30 hover:to-red-500/30 transition-colors text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {broadcasting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
              Clear All User Caches
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            <Radio className="w-3 h-3 inline mr-1" />
            "Clear All User Caches" broadcasts a signal to all connected clients to clear their local thumbnail caches.
          </p>
        </div>
      </GlassCard>

      {/* Content Browser */}
      <GlassCard variant="elevated">
        <GlassCardHeader 
          title="Content Browser" 
          icon={<Film className="w-5 h-5 text-purple-400" />}
          action={
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex rounded-xl bg-white/5 p-1">
                <button
                  onClick={() => setViewMode('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'active' 
                      ? 'bg-primary text-white' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Active ({files.length})
                </button>
                <button
                  onClick={() => setViewMode('trash')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'trash' 
                      ? 'bg-red-500 text-white' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Trash ({trashedFiles.length})
                </button>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search files or users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48 ios-input h-9 text-sm"
                />
              </div>
            </div>
          }
        />
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {filteredFiles.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-center gap-4 p-4 rounded-2xl ios-glass-subtle hover:bg-white/5 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                      {file.thumbnail_url ? (
                        <img 
                          src={file.thumbnail_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getFileIcon(file.mime_type)
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.original_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.user_name} • {formatSize(file.size_bytes)}
                      </p>
                    </div>

                    {/* Analytics Badge */}
                    {file.analytics && (file.analytics.views > 0 || file.analytics.downloads > 0) && (
                      <div className="flex items-center gap-2 text-xs">
                        {file.analytics.views > 0 && (
                          <span className="flex items-center gap-1 text-teal-400" title="Views">
                            <Eye className="w-3 h-3" />
                            {file.analytics.views}
                          </span>
                        )}
                        {file.analytics.downloads > 0 && (
                          <span className="flex items-center gap-1 text-purple-400" title="Downloads">
                            <Download className="w-3 h-3" />
                            {file.analytics.downloads}
                          </span>
                        )}
                        {file.analytics.bandwidth > 0 && (
                          <span className="flex items-center gap-1 text-amber-400" title="Bandwidth Used">
                            <BarChart3 className="w-3 h-3" />
                            {formatSize(file.analytics.bandwidth)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {viewMode === 'active' ? (
                        <>
                          {file.mime_type.startsWith('video/') && (
                            <button
                              onClick={() => handleStreamFile(file)}
                              className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                              title="Stream Video"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {file.mime_type.startsWith('image/') && (
                            <button
                              onClick={() => handleStreamFile(file)}
                              className="p-2 rounded-xl bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors"
                              title="View Image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              lightHaptic();
                              setFileToDelete(file);
                            }}
                            className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Move to Trash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Restore Button */}
                          <button
                            onClick={() => handleRestoreFile(file)}
                            disabled={restoring === file.id}
                            className="p-2 rounded-xl bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors disabled:opacity-50"
                            title="Restore File"
                          >
                            {restoring === file.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                          {/* Permanent Delete Button */}
                          <button
                            onClick={() => {
                              lightHaptic();
                              setFileToPermanentDelete(file);
                            }}
                            className="p-2 rounded-xl bg-gradient-to-r from-red-500/30 to-orange-500/30 text-red-400 hover:from-red-500/40 hover:to-orange-500/40 transition-colors"
                            title="Permanently Delete"
                          >
                            <Flame className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredFiles.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  {viewMode === 'active' ? (
                    <>
                      <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No files found</p>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Trash is empty</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedFile && streamUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => {
              setSelectedFile(null);
              setStreamUrl(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedFile.original_name}
                  </h3>
                  <p className="text-sm text-white/50">
                    {selectedFile.user_name} • {formatSize(selectedFile.size_bytes)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setStreamUrl(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <span className="text-white">✕</span>
                </button>
              </div>

              {selectedFile.mime_type.startsWith('video/') ? (
                <VideoPlayer
                  src={streamUrl}
                />
              ) : (
                <img
                  src={streamUrl}
                  alt={selectedFile.original_name}
                  className="w-full h-auto max-h-[70vh] object-contain rounded-xl"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent className="ios-glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{fileToDelete?.original_name}</span>?
              <br />
              <span className="text-xs">Owner: {fileToDelete?.user_name} ({fileToDelete?.user_email})</span>
              <br />
              <span className="text-xs text-amber-400">This will move the file to trash. The user can still recover it.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleting}
              className="ios-button-secondary"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToDelete && handleDeleteFile(fileToDelete)}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToPermanentDelete} onOpenChange={(open) => !open && setFileToPermanentDelete(null)}>
        <AlertDialogContent className="ios-glass border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Flame className="w-5 h-5 text-orange-500" />
              Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground space-y-2">
              <span className="block">
                You are about to <span className="font-bold text-red-400">permanently delete</span>{' '}
                <span className="font-medium text-foreground">{fileToPermanentDelete?.original_name}</span>
              </span>
              <span className="block text-xs">
                Owner: {fileToPermanentDelete?.user_name} ({fileToPermanentDelete?.user_email})
              </span>
              <span className="block text-xs text-red-400 bg-red-500/10 p-2 rounded-lg mt-2">
                ⚠️ This action is IRREVERSIBLE. The file will be removed from VPS storage and cannot be recovered.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={permanentDeleting}
              className="ios-button-secondary"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToPermanentDelete && handlePermanentDelete(fileToPermanentDelete)}
              disabled={permanentDeleting}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
            >
              {permanentDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Flame className="w-4 h-4 mr-2" />
              )}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContentManagement;

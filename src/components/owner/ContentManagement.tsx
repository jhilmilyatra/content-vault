import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Trash2, 
  Loader2, 
  HardDrive, 
  Users, 
  Play, 
  Eye, 
  Download,
  RefreshCw,
  Search,
  Film,
  Image as ImageIcon,
  FileText,
  ExternalLink,
  Shield,
  Zap
} from 'lucide-react';
import { GlassCard, GlassCardHeader } from '@/components/ios/GlassCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCacheStats, clearThumbnailCache } from '@/lib/thumbnailCache';
import { mediumHaptic, lightHaptic } from '@/lib/haptics';
import { Input } from '@/components/ui/input';
import { VideoPlayer } from '@/components/media';

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
}

interface CacheStats {
  count: number;
  totalSizeMB: number;
}

const ContentManagement = () => {
  const [localCacheStats, setLocalCacheStats] = useState<CacheStats>({ count: 0, totalSizeMB: 0 });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<UserFile | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load local cache stats
      const cacheStats = await getCacheStats();
      setLocalCacheStats(cacheStats);

      // Load file statistics
      const { data: filesData, count } = await supabase
        .from('files')
        .select('id, name, original_name, mime_type, size_bytes, storage_path, created_at, user_id, thumbnail_url', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filesData) {
        // Get user info for each file
        const userIds = [...new Set(filesData.map(f => f.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const enrichedFiles = filesData.map(file => ({
          ...file,
          user_email: profileMap.get(file.user_id)?.email || 'Unknown',
          user_name: profileMap.get(file.user_id)?.full_name || 'Unknown User',
        }));

        setFiles(enrichedFiles);
        setTotalFiles(count || 0);

        // Calculate total size
        const totalBytes = filesData.reduce((acc, f) => acc + Number(f.size_bytes), 0);
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
      toast.success('All local caches cleared');
    } catch (error) {
      toast.error('Failed to clear caches');
    } finally {
      setClearing(false);
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

  const filteredFiles = files.filter(file => 
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
              Clear Local Cache
            </button>
            
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground text-sm inline-flex items-center gap-2">
              <Database className="w-4 h-4" />
              Server-side cache managed automatically
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Content Browser */}
      <GlassCard variant="elevated">
        <GlassCardHeader 
          title="Content Browser" 
          icon={<Film className="w-5 h-5 text-purple-400" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 ios-input h-9 text-sm"
              />
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

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredFiles.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No files found</p>
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
                  crossOrigin={false}
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
    </div>
  );
};

export default ContentManagement;

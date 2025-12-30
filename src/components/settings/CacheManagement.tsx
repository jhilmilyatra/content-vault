import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Trash2, Loader2, Database, ImageIcon, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import { toast } from 'sonner';
import { getCacheStats, clearThumbnailCache } from '@/lib/thumbnailCache';
import { mediumHaptic, lightHaptic } from '@/lib/haptics';

interface CacheStats {
  count: number;
  totalSizeMB: number;
}

const CacheManagement = () => {
  const [stats, setStats] = useState<CacheStats>({ count: 0, totalSizeMB: 0 });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    mediumHaptic();
    setClearing(true);
    try {
      await clearThumbnailCache();
      setStats({ count: 0, totalSizeMB: 0 });
      toast.success('Cache cleared successfully');
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const formatSize = (sizeMB: number) => {
    if (sizeMB < 1) return `${Math.round(sizeMB * 1024)} KB`;
    return `${sizeMB.toFixed(2)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-6"
    >
      <GlassCard variant="elevated" className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-1">Thumbnail Cache</h2>
          <p className="text-sm text-white/40">
            Cached thumbnails for faster loading and offline access
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl ios-glass-light">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{stats.count}</p>
                <p className="text-xs text-white/40">Cached Images</p>
              </div>
              
              <div className="p-4 rounded-2xl ios-glass-light">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <Database className="w-5 h-5 text-teal-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{formatSize(stats.totalSizeMB)}</p>
                <p className="text-xs text-white/40">Storage Used</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Cache Usage</span>
                <span className="text-white/70">{formatSize(stats.totalSizeMB)} / 100 MB</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-teal-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.totalSizeMB / 100) * 100, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  lightHaptic();
                  loadStats();
                }}
                disabled={loading}
                className="ios-button-secondary px-4 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={handleClearCache}
                disabled={clearing || stats.count === 0}
                className="ios-button-primary px-4 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
              >
                {clearing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Clear Cache
              </button>
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex gap-3">
                <HardDrive className="w-5 h-5 text-white/40 shrink-0 mt-0.5" />
                <div className="text-sm text-white/50">
                  <p>
                    Thumbnails are cached locally for 7 days and automatically cleaned when storage
                    exceeds 100 MB. Clearing the cache may temporarily slow down image loading.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default CacheManagement;

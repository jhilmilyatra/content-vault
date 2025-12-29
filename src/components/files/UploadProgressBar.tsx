import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, CheckCircle2, AlertCircle, Upload, X, Pause, Play, 
  Layers, Zap, FileUp, Sparkles, CloudUpload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatSpeed, formatTime, type UploadProgress } from "@/lib/fileService";
import { lightHaptic } from "@/lib/haptics";

interface UploadProgressBarProps {
  uploads: UploadProgress[];
  onCancel?: () => void;
}

const UploadProgressBar = ({ uploads, onCancel }: UploadProgressBarProps) => {
  if (uploads.length === 0) return null;

  const totalProgress = uploads.reduce((acc, u) => acc + u.percentage, 0) / uploads.length;
  const totalLoaded = uploads.reduce((acc, u) => acc + u.loaded, 0);
  const totalSize = uploads.reduce((acc, u) => acc + u.total, 0);
  const avgSpeed = uploads.reduce((acc, u) => acc + u.speed, 0) / uploads.filter(u => u.status === 'uploading').length || 0;
  const isComplete = uploads.every(u => u.status === 'complete');
  const hasError = uploads.some(u => u.status === 'error');
  const hasChunkedUploads = uploads.some(u => u.chunked);
  const activeUploads = uploads.filter(u => u.status === 'uploading').length;
  const completedUploads = uploads.filter(u => u.status === 'complete').length;

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'preparing':
        return <Loader2 className="w-4 h-4 animate-spin text-white/40" />;
      case 'uploading':
        return (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <FileUp className="w-4 h-4 text-gold" />
          </motion.div>
        );
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (upload: UploadProgress) => {
    if (upload.chunked) {
      switch (upload.status) {
        case 'preparing': return 'Initializing...';
        case 'uploading': return `Chunk ${upload.currentChunk}/${upload.totalChunks}`;
        case 'processing': return 'Assembling...';
        case 'complete': return 'Complete';
        case 'error': return 'Failed';
        case 'paused': return 'Paused';
        default: return '';
      }
    }
    switch (upload.status) {
      case 'preparing': return 'Preparing...';
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing...';
      case 'complete': return 'Complete';
      case 'error': return 'Failed';
      default: return '';
    }
  };

  const getFileGradient = (status: UploadProgress['status']) => {
    switch (status) {
      case 'complete': return 'from-emerald-500/20 to-green-500/20 border-emerald-500/30';
      case 'error': return 'from-red-500/20 to-rose-500/20 border-red-500/30';
      case 'uploading': return 'from-gold/20 to-amber-500/20 border-gold/30';
      default: return 'from-white/[0.03] to-white/[0.01] border-white/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/[0.08] shadow-2xl"
    >
      {/* Ambient glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ 
            opacity: isComplete ? [0.3, 0.5, 0.3] : [0.1, 0.2, 0.1],
            scale: isComplete ? [1, 1.1, 1] : 1
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl ${
            isComplete ? 'bg-emerald-500/30' : hasError ? 'bg-red-500/20' : 'bg-gold/20'
          }`}
        />
      </div>

      {/* Header */}
      <div className="relative p-4 pb-0">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${
              isComplete 
                ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30' 
                : hasError 
                  ? 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/30'
                  : 'bg-gradient-to-br from-gold/20 to-amber-500/10 border border-gold/30'
            }`}
          >
            {isComplete ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </motion.div>
            ) : hasError ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <CloudUpload className="w-6 h-6 text-gold" />
              </motion.div>
            )}
            
            {/* Pulse ring for active uploads */}
            {!isComplete && !hasError && (
              <motion.div
                animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-xl border-2 border-gold/50"
              />
            )}
          </motion.div>

          {/* Title & Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-white font-outfit">
                {isComplete 
                  ? 'Upload Complete' 
                  : hasError 
                    ? 'Upload Failed' 
                    : 'Uploading Files'}
              </h3>
              {hasChunkedUploads && !isComplete && (
                <span className="flex items-center gap-1 text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full border border-gold/20">
                  <Layers className="w-3 h-3" />
                  Chunked
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span>{completedUploads}/{uploads.length} files</span>
              {!isComplete && !hasError && avgSpeed > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-gold" />
                    {formatSpeed(avgSpeed)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Percentage & Cancel */}
          <div className="flex items-center gap-3">
            <motion.div 
              key={Math.round(totalProgress)}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={`text-2xl font-bold tabular-nums ${
                isComplete ? 'text-emerald-400' : hasError ? 'text-red-400' : 'text-gold'
              }`}
            >
              {Math.round(totalProgress)}%
            </motion.div>
            {!isComplete && onCancel && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  lightHaptic();
                  onCancel();
                }}
                className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative px-4 py-3">
        <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
          {/* Background glow */}
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{ display: isComplete || hasError ? 'none' : 'block' }}
          />
          {/* Progress fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`absolute inset-y-0 left-0 rounded-full ${
              isComplete 
                ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                : hasError 
                  ? 'bg-gradient-to-r from-red-500 to-rose-400'
                  : 'bg-gradient-to-r from-gold via-gold-light to-amber-400'
            }`}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-white/40">
          <span className="tabular-nums">
            {formatFileSize(totalLoaded)} / {formatFileSize(totalSize)}
          </span>
          {!isComplete && !hasError && avgSpeed > 0 && (
            <span className="tabular-nums">
              ~{formatTime((totalSize - totalLoaded) / avgSpeed)} remaining
            </span>
          )}
        </div>
      </div>

      {/* Individual Files */}
      {uploads.length > 1 && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-white/[0.05] max-h-52 overflow-y-auto"
        >
          <div className="p-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {uploads.map((upload, index) => (
                <motion.div
                  key={`${upload.fileName}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${getFileGradient(upload.status)} border transition-all`}
                >
                  {getStatusIcon(upload.status)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {upload.fileName}
                      </p>
                      {upload.chunked && upload.status === 'uploading' && (
                        <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded-full">
                          {upload.currentChunk}/{upload.totalChunks}
                        </span>
                      )}
                    </div>
                    
                    {/* Individual progress bar */}
                    <div className="relative h-1 rounded-full bg-white/[0.05] mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.percentage}%` }}
                        className={`absolute inset-y-0 left-0 rounded-full ${
                          upload.status === 'complete' 
                            ? 'bg-emerald-400' 
                            : upload.status === 'error' 
                              ? 'bg-red-400'
                              : 'bg-gold'
                        }`}
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-white/60 font-medium tabular-nums">
                      {upload.percentage}%
                    </span>
                    <span className="text-[10px] text-white/30">
                      {formatFileSize(upload.total)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Completion celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none overflow-hidden"
          >
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: Math.random() * 100 - 50,
                  y: 50
                }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.5],
                  y: -100,
                  x: Math.random() * 200 - 100
                }}
                transition={{ 
                  duration: 1.5,
                  delay: i * 0.1,
                  ease: "easeOut"
                }}
                className="absolute bottom-0 left-1/2"
              >
                <Sparkles className="w-4 h-4 text-gold" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UploadProgressBar;

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, Upload, X, Pause, Play, Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatFileSize, formatSpeed, formatTime, type UploadProgress } from "@/lib/fileService";

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

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'preparing':
        return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
      case 'uploading':
        return <Upload className="w-4 h-4 text-primary animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (upload: UploadProgress) => {
    if (upload.chunked) {
      switch (upload.status) {
        case 'preparing': return 'Initializing...';
        case 'uploading': return `Chunk ${upload.currentChunk}/${upload.totalChunks}`;
        case 'processing': return 'Assembling file...';
        case 'complete': return 'Complete';
        case 'error': return 'Failed';
        case 'paused': return 'Paused (can resume)';
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

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="p-4 rounded-lg bg-card border border-border overflow-hidden"
    >
      {/* Overall Progress */}
      <div className="flex items-center gap-4 mb-3">
        {isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : hasError ? (
          <AlertCircle className="w-5 h-5 text-destructive" />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                {isComplete 
                  ? `${uploads.length} file(s) uploaded` 
                  : hasError 
                    ? 'Upload failed' 
                    : `Uploading ${uploads.length} file(s)...`}
              </p>
              {hasChunkedUploads && !isComplete && (
                <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  <Layers className="w-3 h-3" />
                  Chunked
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isComplete && !hasError && avgSpeed > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatSpeed(avgSpeed)}
                </span>
              )}
              <span className="text-sm font-medium text-foreground">
                {Math.round(totalProgress)}%
              </span>
            </div>
          </div>
          <Progress value={totalProgress} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {formatFileSize(totalLoaded)} / {formatFileSize(totalSize)}
            </span>
            {!isComplete && !hasError && avgSpeed > 0 && (
              <span className="text-xs text-muted-foreground">
                ~{formatTime((totalSize - totalLoaded) / avgSpeed)} remaining
              </span>
            )}
          </div>
        </div>
        {!isComplete && onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Individual Files */}
      {uploads.length > 1 && (
        <div className="space-y-2 mt-4 pt-3 border-t border-border max-h-48 overflow-y-auto">
          <AnimatePresence>
            {uploads.map((upload, index) => (
              <motion.div
                key={`${upload.fileName}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
              >
                {getStatusIcon(upload.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {upload.fileName}
                    </p>
                    {upload.chunked && (
                      <span className="text-[9px] text-primary bg-primary/10 px-1 rounded">
                        {upload.currentChunk}/{upload.totalChunks}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={upload.percentage} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                      {upload.percentage}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatFileSize(upload.total)}
                  </span>
                  {upload.chunked && upload.status === 'uploading' && (
                    <span className="text-[9px] text-muted-foreground">
                      {getStatusText(upload)}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default UploadProgressBar;
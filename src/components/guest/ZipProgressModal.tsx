import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderArchive, 
  FileCheck, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Files,
  HardDrive
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/fileService';

interface ZipProgressModalProps {
  open: boolean;
  onClose: () => void;
  folderName: string;
  totalFiles: number;
  totalSize: number;
  status: 'preparing' | 'processing' | 'complete' | 'error';
  errorMessage?: string;
  onDownloadComplete?: () => void;
}

export const ZipProgressModal = ({
  open,
  onClose,
  folderName,
  totalFiles,
  totalSize,
  status,
  errorMessage,
  onDownloadComplete,
}: ZipProgressModalProps) => {
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate progress based on estimated processing time
  useEffect(() => {
    if (status === 'processing') {
      const estimatedTimePerFile = 500; // ms per file estimate
      const totalTime = totalFiles * estimatedTimePerFile;
      const interval = 100; // Update every 100ms
      const increment = (100 / (totalTime / interval));

      const timer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + increment;
          // Cap at 95% until complete
          return newProgress >= 95 ? 95 : newProgress;
        });
        setCurrentFile(prev => {
          const newFile = prev + (totalFiles / (totalTime / interval));
          return Math.min(Math.floor(newFile), totalFiles - 1);
        });
        setElapsedTime(prev => prev + interval);
      }, interval);

      return () => clearInterval(timer);
    } else if (status === 'complete') {
      setProgress(100);
      setCurrentFile(totalFiles);
    } else if (status === 'preparing') {
      setProgress(0);
      setCurrentFile(0);
      setElapsedTime(0);
    }
  }, [status, totalFiles]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
        return <Loader2 className="w-8 h-8 text-primary animate-spin" />;
      case 'processing':
        return <FolderArchive className="w-8 h-8 text-primary animate-pulse" />;
      case 'complete':
        return <CheckCircle2 className="w-8 h-8 text-green-500" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-destructive" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return 'Preparing files...';
      case 'processing':
        return 'Creating ZIP archive...';
      case 'complete':
        return 'Download complete!';
      case 'error':
        return 'Failed to create ZIP';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && status !== 'processing' && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              {getStatusIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{folderName}</h3>
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
        </div>

        {/* Progress section */}
        <div className="p-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              className="p-4 rounded-lg bg-muted/50 border border-border"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Files className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Files</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">
                  {status === 'complete' ? totalFiles : currentFile}
                </span>
                <span className="text-sm text-muted-foreground">/ {totalFiles}</span>
              </div>
            </motion.div>

            <motion.div 
              className="p-4 rounded-lg bg-muted/50 border border-border"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <HardDrive className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Size</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatFileSize(totalSize)}
              </div>
            </motion.div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-3" />
              <AnimatePresence>
                {status === 'processing' && (
                  <motion.div
                    className="absolute inset-0 overflow-hidden rounded-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Time elapsed */}
          {status === 'processing' && (
            <motion.div 
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Elapsed: {formatTime(elapsedTime)}</span>
            </motion.div>
          )}

          {/* Current file indicator */}
          {status === 'processing' && currentFile > 0 && (
            <motion.div 
              className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <FileCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground truncate">
                Processing file {currentFile + 1} of {totalFiles}
              </span>
            </motion.div>
          )}

          {/* Error message */}
          {status === 'error' && errorMessage && (
            <motion.div 
              className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {errorMessage}
            </motion.div>
          )}

          {/* Success message */}
          {status === 'complete' && (
            <motion.div 
              className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              ZIP archive created and downloaded successfully!
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {(status === 'complete' || status === 'error') && (
              <Button 
                onClick={() => {
                  onClose();
                  onDownloadComplete?.();
                }} 
                className="flex-1"
                variant={status === 'complete' ? 'default' : 'outline'}
              >
                {status === 'complete' ? 'Done' : 'Close'}
              </Button>
            )}
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" 
          style={{ 
            width: `${progress}%`, 
            transition: 'width 0.3s ease-out' 
          }} 
        />
      </DialogContent>
    </Dialog>
  );
};

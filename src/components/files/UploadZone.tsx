import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, CloudUpload, FileUp, Plus, X, File, 
  FileImage, FileVideo, FileAudio, FileText, FileArchive,
  Sparkles, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/fileService";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  accept?: string;
  className?: string;
}

interface QueuedFile {
  file: File;
  id: string;
  preview?: string;
}

export function UploadZone({ 
  onFilesSelected, 
  disabled = false,
  maxFiles = 50,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB default
  accept,
  className 
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return FileImage;
    if (type.startsWith("video/")) return FileVideo;
    if (type.startsWith("audio/")) return FileAudio;
    if (type === "application/pdf") return FileText;
    if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return FileArchive;
    return File;
  };

  const getFileGradient = (type: string) => {
    if (type.startsWith("image/")) return "from-pink-500/20 to-rose-500/20 border-pink-500/30";
    if (type.startsWith("video/")) return "from-violet-500/20 to-purple-500/20 border-violet-500/30";
    if (type.startsWith("audio/")) return "from-green-500/20 to-emerald-500/20 border-green-500/30";
    if (type === "application/pdf") return "from-red-500/20 to-orange-500/20 border-red-500/30";
    if (type.includes("zip") || type.includes("rar")) return "from-yellow-500/20 to-amber-500/20 border-yellow-500/30";
    return "from-cyan-500/20 to-blue-500/20 border-cyan-500/30";
  };

  const getFileIconColor = (type: string) => {
    if (type.startsWith("image/")) return "text-pink-400";
    if (type.startsWith("video/")) return "text-violet-400";
    if (type.startsWith("audio/")) return "text-green-400";
    if (type === "application/pdf") return "text-red-400";
    if (type.includes("zip") || type.includes("rar")) return "text-yellow-400";
    return "text-cyan-400";
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).slice(0, maxFiles);
    const validFiles: QueuedFile[] = [];

    fileArray.forEach(file => {
      if (file.size <= maxSize) {
        const queuedFile: QueuedFile = {
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
        };

        // Generate preview for images
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setQueuedFiles(prev => 
              prev.map(f => 
                f.id === queuedFile.id 
                  ? { ...f, preview: reader.result as string }
                  : f
              )
            );
          };
          reader.readAsDataURL(file);
        }

        validFiles.push(queuedFile);
      }
    });

    if (validFiles.length > 0) {
      mediumHaptic();
      setQueuedFiles(prev => [...prev, ...validFiles]);
      setShowQueue(true);
    }
  }, [maxFiles, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCountRef.current = 0;

    if (disabled) return;

    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFromQueue = (id: string) => {
    lightHaptic();
    setQueuedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = () => {
    if (queuedFiles.length === 0) return;
    mediumHaptic();
    onFilesSelected(queuedFiles.map(f => f.file));
    setQueuedFiles([]);
    setShowQueue(false);
  };

  const clearQueue = () => {
    lightHaptic();
    setQueuedFiles([]);
    setShowQueue(false);
  };

  const totalSize = queuedFiles.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <>
      {/* Main Drop Zone */}
      <motion.div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all cursor-pointer group",
          isDragging 
            ? "border-gold bg-gold/5 scale-[1.02]" 
            : "border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.03]",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={isDragging ? { 
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1]
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gold/20 blur-3xl"
          />
          <motion.div
            animate={isDragging ? { 
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.2, 1]
            } : {}}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-cyan-500/10 blur-2xl"
          />
        </div>

        <div className="relative p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[200px]">
          {/* Icon */}
          <motion.div
            animate={isDragging ? { y: [0, -10, 0], scale: 1.1 } : {}}
            transition={{ duration: 0.5, repeat: isDragging ? Infinity : 0 }}
            className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all",
              isDragging 
                ? "bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/50 shadow-xl shadow-gold/20" 
                : "bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 group-hover:border-white/20"
            )}
          >
            {isDragging ? (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <FileUp className="w-10 h-10 text-gold" />
              </motion.div>
            ) : (
              <CloudUpload className="w-10 h-10 text-white/40 group-hover:text-white/60 transition-colors" />
            )}
          </motion.div>

          {/* Text */}
          <motion.div
            animate={isDragging ? { opacity: 0.7 } : { opacity: 1 }}
          >
            <h3 className={cn(
              "text-lg font-semibold mb-2 transition-colors font-outfit",
              isDragging ? "text-gold" : "text-white"
            )}>
              {isDragging ? "Drop files here" : "Drag & drop files"}
            </h3>
            <p className="text-sm text-white/40 mb-4">
              or <span className="text-gold hover:text-gold-light transition-colors">browse</span> to select files
            </p>
            <p className="text-xs text-white/30">
              Maximum {maxFiles} files • Up to {formatFileSize(maxSize)} each
            </p>
          </motion.div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </motion.div>

      {/* File Queue Modal */}
      <AnimatePresence>
        {showQueue && queuedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && clearQueue()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-lg bg-black/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white font-outfit">Ready to Upload</h3>
                    <p className="text-xs text-white/40">
                      {queuedFiles.length} file{queuedFiles.length > 1 ? 's' : ''} • {formatFileSize(totalSize)}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={clearQueue}
                  className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* File List */}
              <div className="p-4 max-h-[40vh] overflow-y-auto space-y-2">
                {queuedFiles.map((qf, index) => {
                  const Icon = getFileIcon(qf.file.type);
                  return (
                    <motion.div
                      key={qf.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all group",
                        `bg-gradient-to-r ${getFileGradient(qf.file.type)}`
                      )}
                    >
                      {/* Preview or Icon */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-black/20 flex items-center justify-center">
                        {qf.preview ? (
                          <img src={qf.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Icon className={cn("w-6 h-6", getFileIconColor(qf.file.type))} />
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{qf.file.name}</p>
                        <p className="text-xs text-white/40">{formatFileSize(qf.file.size)}</p>
                      </div>

                      {/* Remove button */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFromQueue(qf.id)}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-white/[0.06] flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add More
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1 rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold shadow-lg shadow-gold/30 hover:shadow-gold/40"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {queuedFiles.length} File{queuedFiles.length > 1 ? 's' : ''}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default UploadZone;

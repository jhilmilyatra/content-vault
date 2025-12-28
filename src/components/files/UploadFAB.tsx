import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Upload, FolderPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadFABProps {
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  disabled?: boolean;
}

const UploadFAB = ({ onUploadClick, onNewFolderClick, disabled }: UploadFABProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleUpload = () => {
    setIsOpen(false);
    onUploadClick();
  };

  const handleNewFolder = () => {
    setIsOpen(false);
    onNewFolderClick();
  };

  return (
    <div 
      ref={fabRef}
      className="fixed right-4 bottom-24 z-40 flex flex-col-reverse items-center gap-3 sm:bottom-6 sm:right-6"
    >
      {/* Action items - appear above main FAB */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Upload Files */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25,
                delay: 0.05 
              }}
              onClick={handleUpload}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl",
                "glass-elevated",
                "touch-manipulation press-scale",
                "shadow-lg"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground pr-2">Upload Files</span>
            </motion.button>

            {/* New Folder */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25,
                delay: 0 
              }}
              onClick={handleNewFolder}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl",
                "glass-elevated",
                "touch-manipulation press-scale",
                "shadow-lg"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <FolderPlus className="w-5 h-5 text-secondary-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground pr-2">New Folder</span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggleMenu}
        disabled={disabled}
        className={cn(
          "w-14 h-14 rounded-2xl",
          "glass-elevated",
          "flex items-center justify-center",
          "touch-manipulation",
          "shadow-lg",
          "transition-all duration-fast ease-natural",
          isOpen && "rotate-45",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          boxShadow: isOpen 
            ? "0 8px 32px -8px hsl(var(--primary) / 0.3)" 
            : "0 8px 32px -8px hsl(222 47% 2% / 0.4)"
        }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Plus className={cn(
            "w-6 h-6 transition-colors duration-fast",
            isOpen ? "text-destructive" : "text-primary"
          )} />
        </motion.div>
      </motion.button>

      {/* Backdrop when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-background/40 backdrop-blur-sm -z-10"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadFAB;
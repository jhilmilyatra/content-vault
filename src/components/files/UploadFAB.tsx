import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FolderPlus, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

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
      lightHaptic();
      setIsOpen(!isOpen);
    }
  };

  const handleUpload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UploadFAB] Upload button clicked');
    mediumHaptic();
    setIsOpen(false);
    onUploadClick();
  };

  const handleNewFolder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[UploadFAB] New folder button clicked');
    lightHaptic();
    setIsOpen(false);
    onNewFolderClick();
  };

  return (
    <>
      {/* Backdrop when open - separate from FAB container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB container */}
      <div 
        ref={fabRef}
        className="fixed right-4 bottom-20 z-50 flex flex-col-reverse items-end gap-3 sm:bottom-6 sm:right-6"
      >
        {/* Action items - appear above main FAB */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Upload Files */}
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 25,
                  delay: 0.05 
                }}
                onClick={handleUpload}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl",
                  "bg-background/95 backdrop-blur-xl border border-border",
                  "touch-manipulation active:scale-95 transition-transform",
                  "shadow-2xl cursor-pointer"
                )}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <CloudUpload className="w-5 h-5 text-primary" />
                </div>
                <div className="pr-2 text-left">
                  <span className="text-sm font-semibold text-foreground block">Upload Files</span>
                  <span className="text-[10px] text-muted-foreground">Tap to browse</span>
                </div>
              </motion.button>

              {/* New Folder */}
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 25,
                  delay: 0 
                }}
                onClick={handleNewFolder}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl",
                  "bg-background/95 backdrop-blur-xl border border-border",
                  "touch-manipulation active:scale-95 transition-transform",
                  "shadow-2xl cursor-pointer"
                )}
              >
                <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center">
                  <FolderPlus className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="pr-2 text-left">
                  <span className="text-sm font-semibold text-foreground block">New Folder</span>
                  <span className="text-[10px] text-muted-foreground">Organize your files</span>
                </div>
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB - Glass morphism style */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleMenu}
          disabled={disabled}
          className={cn(
            "relative w-14 h-14 rounded-full overflow-hidden",
            "flex items-center justify-center",
            "touch-manipulation cursor-pointer",
            "transition-all duration-300",
            "bg-background/80 backdrop-blur-xl",
            "border-2",
            isOpen ? "border-destructive/50" : "border-primary/30",
            "shadow-2xl shadow-black/40",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Subtle glow effect */}
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-300",
            isOpen 
              ? "bg-destructive/10" 
              : "bg-primary/10"
          )} />

          {/* Icon */}
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative z-10"
          >
            <Plus className={cn(
              "w-6 h-6 transition-colors duration-300",
              isOpen ? "text-destructive" : "text-primary"
            )} />
          </motion.div>
          
          {/* Pulse ring when closed */}
          {!isOpen && !disabled && (
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-primary/50"
            />
          )}
        </motion.button>
      </div>
    </>
  );
};

export default UploadFAB;

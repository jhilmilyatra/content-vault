import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Upload, FolderPlus, X, CloudUpload, Sparkles } from "lucide-react";
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

  const handleUpload = () => {
    mediumHaptic();
    setIsOpen(false);
    onUploadClick();
  };

  const handleNewFolder = () => {
    lightHaptic();
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
                "bg-black/80 backdrop-blur-2xl border border-white/10",
                "touch-manipulation active:scale-95 transition-transform",
                "shadow-2xl shadow-gold/20"
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30">
                <CloudUpload className="w-5 h-5 text-black" />
              </div>
              <div className="pr-2">
                <span className="text-sm font-semibold text-white block">Upload Files</span>
                <span className="text-[10px] text-white/40">Drag & drop or browse</span>
              </div>
            </motion.button>

            {/* New Folder */}
            <motion.button
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
                "bg-black/80 backdrop-blur-2xl border border-white/10",
                "touch-manipulation active:scale-95 transition-transform",
                "shadow-2xl"
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                <FolderPlus className="w-5 h-5 text-amber-400" />
              </div>
              <div className="pr-2">
                <span className="text-sm font-semibold text-white block">New Folder</span>
                <span className="text-[10px] text-white/40">Organize your files</span>
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMenu}
        disabled={disabled}
        className={cn(
          "relative w-16 h-16 rounded-2xl overflow-hidden",
          "flex items-center justify-center",
          "touch-manipulation",
          "transition-all duration-300",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Gradient background */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300",
          isOpen 
            ? "bg-gradient-to-br from-red-500 to-rose-600" 
            : "bg-gradient-to-br from-gold via-gold-light to-amber-400"
        )} />
        
        {/* Shimmer effect */}
        <motion.div
          animate={!isOpen ? { 
            x: ['-100%', '100%']
          } : {}}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "linear",
            repeatDelay: 1
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
        
        {/* Shadow */}
        <div className={cn(
          "absolute inset-0 transition-all duration-300",
          isOpen 
            ? "shadow-lg shadow-red-500/30" 
            : "shadow-lg shadow-gold/40"
        )} />

        {/* Icon */}
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="relative z-10"
        >
          <Plus className="w-7 h-7 text-black" />
        </motion.div>
        
        {/* Pulse ring when closed */}
        {!isOpen && !disabled && (
          <motion.div
            animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 rounded-2xl border-2 border-gold"
          />
        )}
      </motion.button>

      {/* Backdrop when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadFAB;

import * as React from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

interface IosSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  snapPoints?: number[];
}

const sheetVariants = {
  hidden: { 
    y: "100%",
    opacity: 0.8,
  },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 35,
    }
  },
  exit: { 
    y: "100%",
    opacity: 0.5,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 40,
    }
  }
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.25 }
  }
};

export function IosSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: IosSheetProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Lock body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    // If dragged down more than 100px or with velocity, close
    if (info.offset.y > 100 || info.velocity.y > 500) {
      mediumHaptic();
      onClose();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          {/* Sheet */}
          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragStart={() => {
              setIsDragging(true);
              lightHaptic();
            }}
            onDragEnd={handleDragEnd}
            className={cn(
              "absolute bottom-0 inset-x-0",
              // iOS glass styling with rounded top
              "ios-glass-elevated rounded-t-3xl",
              "shadow-2xl shadow-black/30",
              // Safe area padding
              "pb-safe-area-inset-bottom",
              "max-h-[90vh] overflow-hidden",
              className
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <motion.div 
                className={cn(
                  "w-10 h-1.5 rounded-full",
                  "bg-muted-foreground/30",
                  isDragging && "bg-muted-foreground/50"
                )}
                animate={{ 
                  width: isDragging ? 48 : 40,
                  backgroundColor: isDragging ? "rgba(128,128,128,0.5)" : "rgba(128,128,128,0.3)"
                }}
                transition={{ duration: 0.15 }}
              />
            </div>

            {/* Header */}
            {(title || description) && (
              <div className="px-6 py-3 text-center">
                {title && (
                  <h2 className="text-lg font-semibold text-foreground">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
              </div>
            )}

            {/* Content - scrollable */}
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 pb-6 pt-4 flex flex-col gap-3 border-t border-border/30">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default IosSheet;

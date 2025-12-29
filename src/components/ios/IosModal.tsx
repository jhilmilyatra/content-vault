import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lightHaptic } from "@/lib/haptics";

interface IosModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.92,
    y: 20,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 350,
      damping: 30,
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1] as const,
    }
  }
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.25 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2, delay: 0.05 }
  }
};

export function IosModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md"
}: IosModalProps) {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg"
  };

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

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative w-full",
              sizeClasses[size],
              // iOS glass styling
              "ios-glass-elevated rounded-3xl",
              "shadow-2xl shadow-black/20",
              "overflow-hidden",
              className
            )}
          >
            {/* Close button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                lightHaptic();
                onClose();
              }}
              className={cn(
                "absolute right-4 top-4 z-10",
                "w-8 h-8 rounded-full",
                "bg-muted/60 backdrop-blur-sm",
                "flex items-center justify-center",
                "text-muted-foreground hover:text-foreground",
                "transition-colors duration-200"
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Header */}
            {(title || description) && (
              <div className="px-6 pt-6 pb-2">
                {title && (
                  <h2 className="text-lg font-semibold text-foreground pr-8">
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

            {/* Content */}
            <div className="px-6 py-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 pb-6 pt-2 flex gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default IosModal;

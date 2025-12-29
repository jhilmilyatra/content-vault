import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

interface ActionSheetAction {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface IosActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

const sheetVariants = {
  hidden: { 
    y: "100%",
    opacity: 0,
  },
  visible: { 
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 40,
    }
  },
  exit: { 
    y: "100%",
    opacity: 0,
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
    transition: { duration: 0.15 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export function IosActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
  cancelLabel = "Cancel"
}: IosActionSheetProps) {
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

  const handleAction = (action: ActionSheetAction) => {
    if (action.disabled) return;
    if (action.destructive) {
      mediumHaptic();
    } else {
      lightHaptic();
    }
    action.onClick();
    onClose();
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          {/* Action Sheet */}
          <motion.div
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md mx-4 mb-4 safe-area-bottom"
          >
            {/* Main actions group */}
            <div className="ios-glass-elevated rounded-2xl overflow-hidden mb-2">
              {/* Header */}
              {(title || message) && (
                <div className="px-4 py-3 text-center border-b border-border/20">
                  {title && (
                    <p className="text-sm font-semibold text-muted-foreground">
                      {title}
                    </p>
                  )}
                  {message && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {message}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              {actions.map((action, index) => (
                <motion.button
                  key={index}
                  whileTap={{ scale: 0.98, backgroundColor: "rgba(128,128,128,0.1)" }}
                  onClick={() => handleAction(action)}
                  disabled={action.disabled}
                  className={cn(
                    "w-full px-4 py-4",
                    "flex items-center justify-center gap-2",
                    "text-base font-medium",
                    "transition-colors duration-150",
                    "border-b border-border/20 last:border-b-0",
                    action.destructive 
                      ? "text-destructive" 
                      : "text-primary",
                    action.disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {action.icon}
                  {action.label}
                </motion.button>
              ))}
            </div>

            {/* Cancel button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                lightHaptic();
                onClose();
              }}
              className={cn(
                "w-full px-4 py-4",
                "ios-glass-elevated rounded-2xl",
                "text-base font-semibold text-primary",
                "transition-colors duration-150"
              )}
            >
              {cancelLabel}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default IosActionSheet;

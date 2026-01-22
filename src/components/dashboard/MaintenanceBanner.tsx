import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useMaintenanceMode } from "@/contexts/FeatureFlagsContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export function MaintenanceBanner() {
  const { isMaintenanceMode, maintenanceMessage } = useMaintenanceMode();
  const [dismissed, setDismissed] = useState(false);

  if (!isMaintenanceMode || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-amber-500/10 border-b border-amber-500/20"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-sm text-amber-200 truncate">
              <span className="font-medium">Maintenance Mode Active</span>
              {maintenanceMessage && (
                <span className="hidden sm:inline text-amber-200/70"> — {maintenanceMessage}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 flex-shrink-0"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MaintenanceBanner;

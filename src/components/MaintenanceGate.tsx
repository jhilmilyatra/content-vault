import { ReactNode } from "react";
import { useMaintenanceMode, useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MaintenanceGateProps {
  children: ReactNode;
  /** If true, bypass maintenance mode (for owner access) */
  bypassForOwner?: boolean;
  /** Current user role */
  userRole?: string | null;
}

export function MaintenanceGate({ 
  children, 
  bypassForOwner = true,
  userRole 
}: MaintenanceGateProps) {
  const { isMaintenanceMode, maintenanceMessage, loading } = useMaintenanceMode();
  const { refetch } = useFeatureFlags();

  // Allow owners to bypass maintenance mode
  if (bypassForOwner && userRole === "owner") {
    return <>{children}</>;
  }

  // Show loading state briefly
  if (loading) {
    return <>{children}</>;
  }

  // Show maintenance page if in maintenance mode
  if (isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Under Maintenance
            </h1>
            <p className="text-muted-foreground">
              {maintenanceMessage || "We're performing scheduled maintenance. Please check back soon."}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Check Status
          </Button>

          <p className="text-xs text-muted-foreground">
            We apologize for the inconvenience and appreciate your patience.
          </p>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

export default MaintenanceGate;

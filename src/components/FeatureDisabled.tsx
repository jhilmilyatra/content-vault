import { motion } from "framer-motion";
import { Ban, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureDisabledProps {
  featureName: string;
  message?: string;
  showBackButton?: boolean;
}

export function FeatureDisabled({ 
  featureName, 
  message,
  showBackButton = true 
}: FeatureDisabledProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <div className="w-20 h-20 mx-auto rounded-2xl bg-muted flex items-center justify-center">
          <Ban className="w-10 h-10 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {featureName} Unavailable
          </h1>
          <p className="text-muted-foreground">
            {message || `This feature has been temporarily disabled by the administrator. Please check back later.`}
          </p>
        </div>

        {showBackButton && (
          <Button
            variant="outline"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        )}
      </motion.div>
    </div>
  );
}

export default FeatureDisabled;

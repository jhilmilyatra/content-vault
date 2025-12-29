import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  FolderOpen, 
  Share2, 
  Shield, 
  Sparkles,
  ChevronRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const steps: OnboardingStep[] = [
  {
    icon: <Upload className="w-12 h-12" />,
    title: "Upload Your Files",
    description: "Drag and drop or tap to upload any file type. We support documents, images, videos, and more.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: <FolderOpen className="w-12 h-12" />,
    title: "Organize with Folders",
    description: "Create folders to keep your files organized. Nested folders help you structure your content perfectly.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: <Share2 className="w-12 h-12" />,
    title: "Share Securely",
    description: "Generate secure share links with optional passwords, expiry dates, and download limits.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: <Shield className="w-12 h-12" />,
    title: "Enterprise Security",
    description: "Your files are protected with end-to-end encryption and stored on secure servers.",
    gradient: "from-emerald-500 to-teal-600",
  },
];

interface PremiumOnboardingProps {
  onComplete: () => void;
  isOpen: boolean;
}

export function PremiumOnboarding({ onComplete, isOpen }: PremiumOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const handleNext = () => {
    lightHaptic();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    lightHaptic();
    handleComplete();
  };

  const handleComplete = () => {
    mediumHaptic();
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const handleStepClick = (index: number) => {
    if (index <= currentStep) {
      lightHaptic();
      setCurrentStep(index);
    }
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Premium backdrop with animated gradient */}
          <motion.div 
            className="absolute inset-0 bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Animated gradient orbs */}
            <motion.div
              className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-gold/20 to-transparent blur-[120px]"
              animate={{
                x: [0, 50, 0],
                y: [0, -30, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-cyan-500/15 to-transparent blur-[100px]"
              animate={{
                x: [0, -40, 0],
                y: [0, 40, 0],
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            />
          </motion.div>

          {/* Content container */}
          <div className="relative z-10 w-full max-w-lg mx-4">
            {/* Skip button */}
            <motion.button
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={handleSkip}
              className="absolute -top-12 right-0 text-white/40 hover:text-white/70 transition-colors text-sm font-medium"
            >
              Skip Tour
            </motion.button>

            {/* Main card */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 30,
                delay: 0.1 
              }}
              className="relative overflow-hidden rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]"
            >
              {/* Premium shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.02]" />
              
              {/* Step content */}
              <div className="relative p-8 sm:p-10">
                {/* Logo/Brand */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-center mb-8"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/30">
                      <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <span className="text-xl font-bold text-white tracking-tight font-outfit">Welcome</span>
                  </div>
                </motion.div>

                {/* Animated step content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 400,
                      damping: 35
                    }}
                    className="text-center"
                  >
                    {/* Icon with gradient background */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
                      className={`w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br ${currentStepData.gradient} flex items-center justify-center shadow-2xl`}
                      style={{
                        boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5)`,
                      }}
                    >
                      <div className="text-white">
                        {currentStepData.icon}
                      </div>
                    </motion.div>

                    {/* Title */}
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight font-outfit"
                    >
                      {currentStepData.title}
                    </motion.h2>

                    {/* Description */}
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-white/60 text-base sm:text-lg leading-relaxed max-w-sm mx-auto"
                    >
                      {currentStepData.description}
                    </motion.p>
                  </motion.div>
                </AnimatePresence>

                {/* Progress indicators */}
                <div className="flex items-center justify-center gap-2 mt-8 mb-8">
                  {steps.map((_, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleStepClick(index)}
                      className={`relative h-2 rounded-full transition-all duration-300 ${
                        index <= currentStep ? "cursor-pointer" : "cursor-default"
                      }`}
                      style={{
                        width: index === currentStep ? 32 : 8,
                      }}
                      whileHover={index <= currentStep ? { scale: 1.1 } : {}}
                      whileTap={index <= currentStep ? { scale: 0.95 } : {}}
                    >
                      <div
                        className={`absolute inset-0 rounded-full transition-all duration-300 ${
                          index === currentStep
                            ? "bg-gradient-to-r from-gold to-gold-light"
                            : index < currentStep
                            ? "bg-gold/50"
                            : "bg-white/20"
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {currentStep > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        onClick={() => {
                          lightHaptic();
                          setCurrentStep(currentStep - 1);
                        }}
                        className="w-full h-12 rounded-xl border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
                      >
                        Back
                      </Button>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex-1"
                  >
                    <Button
                      onClick={handleNext}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-gold to-gold-light text-black font-semibold shadow-lg shadow-gold/30 hover:shadow-gold/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-2">
                        {currentStep === steps.length - 1 ? (
                          <>
                            <Check className="w-4 h-4" />
                            Get Started
                          </>
                        ) : (
                          <>
                            Continue
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* Bottom accent line */}
              <div className="h-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            </motion.div>

            {/* Step counter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center mt-6 text-white/30 text-sm"
            >
              Step {currentStep + 1} of {steps.length}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PremiumOnboarding;

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, FileCheck, Database, Sparkles } from "lucide-react";
import type { FinalizationProgress as FinalizationProgressType } from "@/lib/fileService";

interface FinalizationProgressProps {
  progress: FinalizationProgressType;
}

const phases = [
  { id: 'verifying', label: 'Verifying', icon: FileCheck },
  { id: 'assembling', label: 'Assembling', icon: Sparkles },
  { id: 'creating-record', label: 'Saving', icon: Database },
  { id: 'complete', label: 'Done', icon: CheckCircle2 },
] as const;

const FinalizationProgress = ({ progress }: FinalizationProgressProps) => {
  const currentPhaseIndex = phases.findIndex(p => p.id === progress.phase);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: progress.phase !== 'complete' ? 360 : 0 }}
            transition={{ duration: 1, repeat: progress.phase !== 'complete' ? Infinity : 0, ease: "linear" }}
          >
            <Loader2 className={`w-4 h-4 ${progress.phase === 'complete' ? 'text-emerald-400' : 'text-cyan-400'}`} />
          </motion.div>
          <span className="text-xs font-medium text-white/80">
            {progress.message}
          </span>
        </div>
        <span className="text-xs text-white/40 tabular-nums">
          {progress.progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress.progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
        />
        {/* Shimmer effect */}
        {progress.phase !== 'complete' && (
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        )}
      </div>

      {/* Phase indicators */}
      <div className="flex items-center justify-between">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          const isActive = phase.id === progress.phase;
          const isComplete = index < currentPhaseIndex;
          
          return (
            <div key={phase.id} className="flex flex-col items-center gap-1">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                  opacity: isComplete || isActive ? 1 : 0.3,
                }}
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center transition-colors
                  ${isComplete 
                    ? 'bg-emerald-500/20 border border-emerald-500/40' 
                    : isActive 
                      ? 'bg-cyan-500/20 border border-cyan-500/40'
                      : 'bg-white/5 border border-white/10'
                  }
                `}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isActive ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  </motion.div>
                ) : (
                  <Icon className="w-3.5 h-3.5 text-white/30" />
                )}
              </motion.div>
              <span className={`text-[9px] font-medium ${
                isComplete ? 'text-emerald-400' : isActive ? 'text-cyan-400' : 'text-white/30'
              }`}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Connecting lines between phases */}
      <div className="absolute top-[60px] left-0 right-0 flex items-center justify-between px-[30px] pointer-events-none">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex-1 mx-1">
            <div className={`h-0.5 rounded-full transition-colors ${
              index < currentPhaseIndex ? 'bg-emerald-500/50' : 'bg-white/10'
            }`} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FinalizationProgress;

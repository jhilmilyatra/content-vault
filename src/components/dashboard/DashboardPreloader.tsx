import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

interface DashboardPreloaderProps {
  onComplete?: () => void;
  duration?: number;
}

export const DashboardPreloader = ({ onComplete, duration = 1800 }: DashboardPreloaderProps) => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 100);

    const timer = setTimeout(() => {
      setLoading(false);
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0b0d]"
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />
          </div>
          
          <div className="relative flex flex-col items-center">
            {/* Logo with pulse */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [0.8, 1.05, 1], 
                opacity: 1 
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative z-10 mb-8"
            >
              {/* Outer ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 w-20 h-20 rounded-2xl border border-teal-500/20"
                style={{ 
                  borderRadius: '1rem',
                  background: 'conic-gradient(from 0deg, transparent, rgba(20, 184, 166, 0.3), transparent)'
                }}
              />
              
              <div className="w-20 h-20 rounded-2xl bg-white p-2 flex items-center justify-center shadow-[0_0_60px_rgba(20,184,166,0.4)]">
                <img src={logo} alt="CloudVault" className="w-full h-full object-contain" />
              </div>
            </motion.div>

            {/* Text reveal */}
            <div className="overflow-hidden h-8 mb-6">
              <motion.h2
                initial={{ y: 40 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-xl font-bold text-white tracking-tight"
              >
                CloudVault
              </motion.h2>
            </div>

            {/* Status text */}
            <div className="overflow-hidden h-5 mb-6">
              <motion.span
                initial={{ y: 30 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="block text-[10px] uppercase tracking-[0.4em] font-medium text-white/40"
              >
                Initializing Dashboard
              </motion.span>
            </div>

            {/* Progress Bar */}
            <div className="w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-teal-400 via-blue-500 to-teal-400 bg-[length:200%_100%]"
                style={{
                  animation: 'shimmer 1.5s infinite linear',
                }}
              />
            </div>

            {/* Decorative dots */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex gap-1.5 mt-8"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    opacity: [0.3, 1, 0.3],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity, 
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-teal-400/50"
                />
              ))}
            </motion.div>
          </div>

          {/* Scanline overlay */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DashboardPreloader;

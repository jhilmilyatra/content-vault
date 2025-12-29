import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export const Preloader = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate asset loading or a fixed delay for the "reveal"
    const timer = setTimeout(() => setLoading(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          exit={{ opacity: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0b0d]"
        >
          <div className="relative flex flex-col items-center">
            {/* The "Logo" Pulse */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [0.8, 1.1, 1], 
                opacity: [0, 1, 1] 
              }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="relative z-10 mb-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-[0_0_50px_rgba(20,184,166,0.3)]">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            </motion.div>

            {/* Cinematic Text Reveal */}
            <div className="overflow-hidden h-6">
              <motion.span
                initial={{ y: 30 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="block text-[10px] uppercase tracking-[0.4em] font-bold text-white/40"
              >
                Initializing CloudVault
              </motion.span>
            </div>

            {/* Progress Bar (Apple Style) */}
            <div className="mt-8 w-48 h-[1px] bg-white/5 relative overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-500 to-transparent"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;

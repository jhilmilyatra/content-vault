import { motion } from 'framer-motion';

export const TelemetryPanel = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.8, duration: 0.8 }}
    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
  >
    <div className="glass-card p-4 md:p-6 border-white/10 bg-black/60 backdrop-blur-xl min-w-[280px] md:min-w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-teal-400/80">
          Core Status
        </span>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-white/30">
            Stability
          </span>
          <span className="text-2xl font-bold tracking-tight text-white">
            98.2%
          </span>
        </div>
        
        <div className="h-12 w-24 flex items-end gap-[2px]">
          {[40, 65, 45, 80, 55, 70, 90, 60, 85, 75].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
              className="flex-1 bg-gradient-to-t from-teal-500/50 to-teal-400/80 rounded-t-sm"
            />
          ))}
        </div>
      </div>
      
      <div className="text-[10px] text-white/40 leading-relaxed font-light">
        "Deep space hemisphere operational. Luminescence levels nominal."
      </div>
    </div>
  </motion.div>
);

export default TelemetryPanel;

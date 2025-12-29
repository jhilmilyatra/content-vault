import { motion } from 'framer-motion';

export const Atmosphere = () => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-[#0b0b0d] pointer-events-none">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(20,20,30,1)_0%,_rgba(11,11,13,1)_100%)]" />
    <motion.div 
      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-[20%] -left-[10%] w-[120%] h-[120%]"
      style={{
        background: "radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.1) 0%, transparent 50%)",
        filter: "blur(100px)"
      }}
    />
    {/* Moving Galaxy Horizon */}
    <motion.div 
      animate={{ y: [0, -10, 0], opacity: [0.4, 0.6, 0.4] }}
      transition={{ duration: 10, repeat: Infinity }}
      className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-teal-500/10 to-transparent blur-[120px]" 
    />
  </div>
);

export default Atmosphere;

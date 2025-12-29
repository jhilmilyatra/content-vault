import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Magnetic from "./Magnetic";

const Hero = () => {
  const { user } = useAuth();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 px-6">
      <div className="container relative z-10 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Subtle Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/50">Enterprise Distribution</span>
          </div>

          <h1 className="text-5xl md:text-[90px] font-semibold tracking-tighter leading-[0.95] mb-8">
            <span className="gradient-text">CloudVault.</span><br />
            <span className="text-white/40">Content at scale.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/50 font-light max-w-2xl mx-auto mb-12">
            Multi-tenant infrastructure designed for high-performance distribution.
            Secure, isolated, and globally accelerated.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Magnetic>
              <Link to={user ? "/dashboard" : "/auth"}>
                <button className="px-10 py-4 rounded-full bg-white text-black font-bold hover:scale-105 transition-all duration-500 shadow-xl shadow-white/5">
                  {user ? "Enter Dashboard" : "Start Deploying"}
                </button>
              </Link>
            </Magnetic>

            <Magnetic>
              <button className="px-10 py-4 rounded-full border border-white/10 text-white font-medium hover:bg-white/5 backdrop-blur-md transition-all">
                Documentation
              </button>
            </Magnetic>
          </div>
        </motion.div>

        {/* Floating Preview Frame */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1.2 }}
          className="mt-24 relative max-w-5xl mx-auto group"
        >
          <div className="absolute -inset-1 bg-gradient-to-b from-teal-500/20 to-transparent rounded-[2rem] blur-2xl opacity-50" />
          <div className="relative glass-card overflow-hidden border-white/10 rounded-2xl shadow-2xl bg-black/40">
            <div className="h-8 bg-white/5 border-b border-white/5 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="aspect-video bg-[#0b0b0d] flex items-center justify-center">
              <span className="text-white/10 font-mono tracking-widest">ENCRYPTED_INTERFACE_PREVIEW</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

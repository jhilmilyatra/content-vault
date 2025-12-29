import { motion } from "framer-motion";
import { Shield, Lock, Zap, BarChart3 } from "lucide-react";

const Features = () => {
  return (
    <section id="features" className="relative py-32 px-6">
      <div className="container max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Large Main Feature */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="md:col-span-8 glass-card p-10 flex flex-col justify-between min-h-[400px]"
          >
            <Shield className="w-12 h-12 text-teal-400 mb-6" strokeWidth={1.5} />
            <div>
              <h3 className="text-3xl font-semibold mb-4 tracking-tight">Owner God Panel</h3>
              <p className="text-white/50 max-w-md">Complete infrastructure authority with global analytics and manual premium overrides.</p>
            </div>
          </motion.div>

          {/* Small Feature */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, type: "spring", stiffness: 100, damping: 20 }}
            className="md:col-span-4 glass-card p-10 bg-gradient-to-br from-white/[0.05] to-transparent"
          >
            <Lock className="w-10 h-10 text-rose-400 mb-6" strokeWidth={1.5} />
            <h3 className="text-xl font-semibold mb-2">P2P Security</h3>
            <p className="text-sm text-white/50">Isolated storage per tenant with hardware-level encryption.</p>
          </motion.div>

          {/* Medium Features */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100, damping: 20 }}
            className="md:col-span-4 glass-card p-10"
          >
            <Zap className="w-10 h-10 text-amber-400 mb-6" strokeWidth={1.5} />
            <h3 className="text-xl font-semibold mb-2">Accelerated</h3>
            <p className="text-sm text-white/50">Global CDN with sub-millisecond propagation.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100, damping: 20 }}
            className="md:col-span-8 glass-card p-10 flex items-center gap-10"
          >
            <BarChart3 className="w-20 h-20 text-blue-400 opacity-20 flex-shrink-0" strokeWidth={1.5} />
            <div>
              <h3 className="text-2xl font-semibold mb-2">Deep Analytics</h3>
              <p className="text-sm text-white/50">Real-time bandwidth and revenue tracking across all nodes.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Features;

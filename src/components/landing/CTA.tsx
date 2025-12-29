import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Magnetic from "./Magnetic";

const CTA = () => {
  return (
    <section className="py-40 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="max-w-4xl mx-auto glass-card p-12 md:p-24 text-center border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
        
        <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tighter">
          Ready to scale?
        </h2>
        <p className="text-white/50 text-lg mb-12 max-w-lg mx-auto">
          Join the elite platforms managing their distribution with CloudVault.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Magnetic>
            <Link to="/auth">
              <button className="px-12 py-5 rounded-full bg-white text-black font-bold text-lg hover:bg-opacity-90 transition-all">
                Get Started Now
              </button>
            </Link>
          </Magnetic>
          <Magnetic>
            <a 
              href="https://t.me/riturajprince" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <button className="px-12 py-5 rounded-full border border-white/10 text-white font-medium hover:bg-white/5 transition-all">
                Contact Sales
              </button>
            </a>
          </Magnetic>
        </div>
      </motion.div>
    </section>
  );
};

export default CTA;

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
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Magnetic>
            <Link to="/auth">
              <button className="px-12 py-5 rounded-full bg-white text-black font-bold text-lg hover:bg-opacity-90 transition-all">
                Get Started Now
              </button>
            </Link>
          </Magnetic>
        </div>
        
        <p className="text-white/40 text-sm mb-4">Contact Sales</p>
        <div className="flex gap-6 justify-center">
          <Magnetic>
            <a 
              href="https://t.me/riturajprince" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
              title="Telegram"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
          </Magnetic>
          <Magnetic>
            <a 
              href="https://instagram.com/theriturajprince" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
              title="Instagram"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </a>
          </Magnetic>
          <Magnetic>
            <a 
              href="mailto:medicobhai@gmail.com"
              className="p-3 rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all"
              title="Email"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </a>
          </Magnetic>
        </div>
      </motion.div>
    </section>
  );
};

export default CTA;

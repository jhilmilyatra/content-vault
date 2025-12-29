import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Magnetic from "./Magnetic";

const Header = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div 
        className={`absolute inset-0 transition-all duration-500 ${
          scrolled 
            ? "bg-black/60 backdrop-blur-lg border-b border-white/5" 
            : "bg-transparent"
        }`} 
      />
      
      <nav className="container max-w-6xl mx-auto px-6 py-4 relative">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tighter text-white">CloudVault</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors font-light">
              Features
            </a>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors font-light">
              Pricing
            </a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors font-light">
              Documentation
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Magnetic>
                <Link to="/dashboard">
                  <button className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:scale-105 transition-all duration-300">
                    Dashboard
                  </button>
                </Link>
              </Magnetic>
            ) : (
              <>
                <Link to="/auth">
                  <button className="text-sm text-white/70 hover:text-white transition-colors font-light">
                    Sign In
                  </button>
                </Link>
                <Magnetic>
                  <Link to="/auth">
                    <button className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:scale-105 transition-all duration-300">
                      Get Started
                    </button>
                  </Link>
                </Magnetic>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            {isOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 bg-black/90 backdrop-blur-lg border-b border-white/5 p-6 md:hidden"
            >
              <div className="flex flex-col gap-4">
                <a 
                  href="#features" 
                  className="text-sm text-white/50 hover:text-white transition-colors font-light"
                  onClick={() => setIsOpen(false)}
                >
                  Features
                </a>
                <a 
                  href="#pricing" 
                  className="text-sm text-white/50 hover:text-white transition-colors font-light"
                  onClick={() => setIsOpen(false)}
                >
                  Pricing
                </a>
                <a 
                  href="#" 
                  className="text-sm text-white/50 hover:text-white transition-colors font-light"
                  onClick={() => setIsOpen(false)}
                >
                  Documentation
                </a>
                <hr className="border-white/5" />
                {user ? (
                  <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                    <button className="w-full py-3 rounded-full bg-white text-black font-bold text-sm">
                      Dashboard
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <button className="w-full py-3 rounded-full border border-white/10 text-white font-medium text-sm">
                        Sign In
                      </button>
                    </Link>
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <button className="w-full py-3 rounded-full bg-white text-black font-bold text-sm">
                        Get Started
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};

export default Header;

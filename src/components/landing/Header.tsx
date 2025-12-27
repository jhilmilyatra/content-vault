import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
// To add your logo: 
// 1. Add your logo image to src/assets/ folder (e.g., logo.png or logo.svg)
// 2. Uncomment the import below and update the filename
// import logo from "@/assets/logo.png";

const Header = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-lg border-b border-border" />
      
      <nav className="container max-w-6xl mx-auto px-4 py-4 relative">
        <div className="flex items-center justify-between">
          {/* Logo - Replace with your own image */}
          <Link to="/" className="flex items-center gap-2">
            {/* Option 1: Use an image logo */}
            {/* <img src={logo} alt="Your Logo" className="w-10 h-10 object-contain" /> */}
            
            {/* Option 2: Text-only logo (current) */}
            <span className="text-xl font-bold text-foreground">CloudVault</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Documentation
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button variant="default" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="default" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-card border-b border-border p-4 md:hidden"
          >
            <div className="flex flex-col gap-4">
              <a 
                href="#features" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Features
              </a>
              <a 
                href="#pricing" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Pricing
              </a>
              <a 
                href="#docs" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Documentation
              </a>
              <hr className="border-border" />
              {user ? (
                <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                  <Button className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button variant="ghost" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </nav>
    </header>
  );
};

export default Header;

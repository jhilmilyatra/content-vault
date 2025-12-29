import { Github, Twitter, Instagram } from "lucide-react";
import Magnetic from "./Magnetic";

const Footer = () => {
  return (
    <footer className="relative pt-32 pb-12 px-6 border-t border-white/5">
      <div className="container max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-24">
          <div className="col-span-2">
            <h3 className="text-xl font-bold tracking-tighter mb-4">CloudVault</h3>
            <p className="text-white/50 text-sm max-w-xs leading-relaxed font-light">
              High-performance content distribution infrastructure. 
              Engineered for absolute security and sub-millisecond sync.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/20 mb-2">Platform</span>
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors font-light">Features</a>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors font-light">Infrastructure</a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors font-light">Security</a>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/20 mb-2">Developer</span>
            <a href="https://instagram.com/theriturajprince" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors font-light">Instagram</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors font-light">GitHub</a>
            <a href="https://t.me/riturajprince" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors font-light">Telegram</a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 gap-6">
          <div className="flex items-center gap-6 text-[10px] tracking-widest text-white/20 uppercase font-bold">
            <span>© 2025 CloudVault</span>
            <span className="hidden md:block">///</span>
            <span>All Rights Reserved</span>
          </div>
          
          <div className="flex items-center gap-6 opacity-30 hover:opacity-100 transition-opacity duration-500">
            <Magnetic>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="w-4 h-4 cursor-pointer" strokeWidth={1.5} />
              </a>
            </Magnetic>
            <Magnetic>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                <Twitter className="w-4 h-4 cursor-pointer" strokeWidth={1.5} />
              </a>
            </Magnetic>
            <Magnetic>
              <a href="https://instagram.com/theriturajprince" target="_blank" rel="noopener noreferrer">
                <Instagram className="w-4 h-4 cursor-pointer" strokeWidth={1.5} />
              </a>
            </Magnetic>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Systems Nominal
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

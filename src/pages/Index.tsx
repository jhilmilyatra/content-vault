import { useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import RoleHierarchy from "@/components/landing/RoleHierarchy";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import Preloader from "@/components/landing/Preloader";
import { CelestialHorizon } from "@/components/visuals/CelestialHorizon";
import { TelemetryPanel } from "@/components/visuals/TelemetryPanel";

const Index = () => {
  const [isWarping, setIsWarping] = useState(false);

  const handleWarpTrigger = () => {
    setIsWarping(true);
    setTimeout(() => setIsWarping(false), 2000);
  };

  return (
    <>
      <Preloader />
      <CelestialHorizon isWarping={isWarping} />
      
      {/* Scanline overlay for digital look */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />
      
      <div className="relative z-10 min-h-screen bg-transparent">
        <Header />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Hero onWarpTrigger={handleWarpTrigger} />
          <TelemetryPanel />
          <Features />
          <RoleHierarchy />
          <Pricing />
          <CTA />
        </motion.main>
        <Footer />
      </div>
    </>
  );
};

export default Index;

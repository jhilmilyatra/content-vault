import { useState, lazy, Suspense } from "react";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import RoleHierarchy from "@/components/landing/RoleHierarchy";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import Preloader from "@/components/landing/Preloader";
import { TelemetryPanel } from "@/components/visuals/TelemetryPanel";

// Lazy load the heavy 3D component - only loads if needed
const CelestialHorizon = lazy(() => import("@/components/visuals/CelestialHorizon"));

// Lightweight CSS background fallback
const LightBackground = () => (
  <div className="fixed inset-0 z-0 pointer-events-none bg-[#0b0b0d] overflow-hidden">
    <div 
      className="absolute left-1/2 bottom-1/4 -translate-x-1/2 w-[500px] h-[250px] rounded-full opacity-20 animate-pulse"
      style={{
        background: 'radial-gradient(ellipse at center, #14b8a6 0%, #00f2ff 30%, transparent 70%)',
        filter: 'blur(40px)',
      }}
    />
  </div>
);

const Index = () => {
  const [isWarping, setIsWarping] = useState(false);
  // Check for reduced motion preference or low-end device
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleWarpTrigger = () => {
    setIsWarping(true);
    setTimeout(() => setIsWarping(false), 2000);
  };

  return (
    <>
      <Preloader />
      
      {/* Use lightweight CSS background by default, load 3D only if user prefers */}
      {prefersReducedMotion ? (
        <LightBackground />
      ) : (
        <Suspense fallback={<LightBackground />}>
          <CelestialHorizon isWarping={isWarping} />
        </Suspense>
      )}
      
      {/* Scanline overlay for digital look */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />
      
      <div className="relative z-10 min-h-screen bg-transparent">
        <Header />
        <main className="animate-fade-in" style={{ animationDelay: '2.5s', animationFillMode: 'backwards' }}>
          <Hero onWarpTrigger={handleWarpTrigger} />
          <TelemetryPanel />
          <Features />
          <RoleHierarchy />
          <Pricing />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;

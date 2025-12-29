import { motion } from "framer-motion";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import RoleHierarchy from "@/components/landing/RoleHierarchy";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import Atmosphere from "@/components/landing/Atmosphere";
import Preloader from "@/components/landing/Preloader";

const Index = () => {
  return (
    <>
      <Preloader />
      <Atmosphere />
      <div className="relative min-h-screen">
        <Header />
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Hero />
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

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Database } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(172_66%_50%/0.1),transparent_50%)]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,hsl(172_66%_50%/0.05),transparent_70%)]" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(172 66% 50%) 1px, transparent 1px), 
                           linear-gradient(90deg, hsl(172 66% 50%) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="container relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-muted-foreground">Enterprise-Grade Content Platform</span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            <span className="text-foreground">Secure Content</span>
            <br />
            <span className="gradient-text">Distribution at Scale</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Multi-tenant SaaS platform for hosting, managing, and sharing digital content.
            Complete with role-based access, analytics, and enterprise security.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button variant="hero" size="xl" className="group">
              Get Started
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="glass" size="xl">
              View Documentation
            </Button>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            {[
              { icon: Shield, label: "End-to-end Security" },
              { icon: Zap, label: "CDN Accelerated" },
              { icon: Database, label: "Multi-tenant Isolation" },
            ].map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-border"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{feature.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative rounded-xl overflow-hidden border border-border shadow-2xl">
            <div className="bg-card p-1">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                    cloudvault.app/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="aspect-[16/9] bg-gradient-to-br from-card to-muted/20 p-6">
                <div className="grid grid-cols-12 gap-4 h-full">
                  {/* Sidebar */}
                  <div className="col-span-2 rounded-lg bg-sidebar border border-border p-3 space-y-3">
                    <div className="h-8 rounded bg-primary/20" />
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-6 rounded bg-muted" />
                      ))}
                    </div>
                  </div>
                  {/* Main content */}
                  <div className="col-span-10 space-y-4">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-lg bg-card border border-border p-4">
                          <div className="h-3 w-16 rounded bg-muted mb-2" />
                          <div className="h-6 w-24 rounded bg-primary/30" />
                        </div>
                      ))}
                    </div>
                    {/* Content area */}
                    <div className="flex-1 rounded-lg bg-card border border-border p-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="aspect-video rounded bg-muted/50" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

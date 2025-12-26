import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

const benefits = [
  "Unlimited storage scaling",
  "Enterprise security",
  "24/7 monitoring",
  "GDPR compliant"
];

const CTA = () => {
  return (
    <section className="relative py-32 px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(172_66%_50%/0.1),transparent_60%)]" />
      
      <div className="container max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="p-8 sm:p-12 rounded-2xl glass border border-primary/20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Ready to <span className="gradient-text">Get Started?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Deploy your own content distribution platform in minutes. 
              Full control, enterprise security, zero compromises.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle className="w-4 h-4 text-success" />
                  {benefit}
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="xl" className="group">
                Launch Your Platform
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="xl">
                Contact Sales
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import Magnetic from "./Magnetic";

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "For personal projects and testing.",
    features: ["5GB Secure Storage", "10 Monthly Links", "Basic Analytics"],
    cta: "Start for Free",
    featured: false
  },
  {
    name: "Professional",
    price: "$29",
    description: "The gold standard for growing platforms.",
    features: ["500GB Storage", "Unlimited Links", "Custom Domains", "Priority CDN"],
    cta: "Get Started",
    featured: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "High-volume infrastructure control.",
    features: ["Multi-Region Nodes", "White-label Panel", "24/7 Node Monitoring", "Direct API Access"],
    cta: "Contact Sales",
    featured: false
  }
];

const Pricing = () => {
  return (
    <section id="pricing" className="relative py-32 px-6 overflow-hidden">
      <div className="container max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter mb-4">
            Simple <span className="text-white/40">Scale.</span>
          </h2>
          <p className="text-white/50 font-light max-w-lg mx-auto">
            Transparent pricing for teams moving at the speed of light.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, type: "spring", stiffness: 100, damping: 20 }}
              className={`relative glass-card p-10 flex flex-col ${
                plan.featured 
                  ? "border-teal-500/30 bg-white/[0.04] py-16 shadow-[0_0_80px_rgba(20,184,166,0.1)]" 
                  : "bg-black/40 border-white/5"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-teal-500 text-[10px] font-bold uppercase tracking-widest text-black">
                  Most Popular
                </div>
              )}

              <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-white/30 mb-2">
                {plan.name}
              </span>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold tracking-tighter">{plan.price}</span>
                {plan.price !== "Custom" && <span className="text-white/50">/mo</span>}
              </div>

              <p className="text-sm text-white/50 mb-8 font-light min-h-[40px]">
                {plan.description}
              </p>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-white/70">
                    <Check className={`w-4 h-4 ${plan.featured ? "text-teal-400" : "text-white/20"}`} strokeWidth={1.5} />
                    {feature}
                  </div>
                ))}
              </div>

              <Magnetic>
                <Link to={plan.name === "Enterprise" ? "#" : "/auth"}>
                  <button className={`w-full py-4 rounded-full font-bold transition-all duration-500 ${
                    plan.featured 
                    ? "bg-white text-black hover:scale-[1.02]" 
                    : "border border-white/10 text-white hover:bg-white/5"
                  }`}>
                    {plan.cta}
                  </button>
                </Link>
              </Magnetic>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;

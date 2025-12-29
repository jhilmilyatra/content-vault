import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import Magnetic from "./Magnetic";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "For personal use and testing.",
    features: [
      "5GB Storage",
      "50GB Bandwidth/month",
      "10 Active Links",
      "Basic Analytics"
    ],
    cta: "Start for Free",
    featured: false
  },
  {
    name: "Premium",
    price: "₹199",
    period: "/month",
    description: "For growing creators and teams.",
    features: [
      "100GB Storage",
      "500GB Bandwidth/month",
      "100 Active Links",
      "Advanced Analytics",
      "Priority Support"
    ],
    cta: "Get Premium",
    featured: true
  },
  {
    name: "Lifetime",
    price: "₹4999",
    period: "one-time",
    description: "Pay once, use forever.",
    features: [
      "1TB Storage",
      "Unlimited Bandwidth",
      "Unlimited Links",
      "All Premium Features",
      "Lifetime Updates"
    ],
    cta: "Get Lifetime",
    featured: false
  }
];

const Pricing = () => {
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <section id="pricing" className="relative py-32 px-6 overflow-hidden">
      <div className="container max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tighter mb-4">
            Simple <span className="text-white/40">Pricing.</span>
          </h2>
          <p className="text-white/50 font-light max-w-lg mx-auto">
            Transparent pricing for everyone. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-16">
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
                <span className="text-white/50 text-sm">{plan.period}</span>
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
                <Link to="/auth">
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

        {/* Enterprise Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-10 md:p-16 border-white/5 bg-gradient-to-br from-violet-500/5 to-transparent"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 text-center md:text-left">
              <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-violet-400 mb-2 block">
                Enterprise
              </span>
              <h3 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4">
                Need Custom Solutions?
              </h3>
              <p className="text-white/50 font-light max-w-lg">
                High-volume infrastructure, white-label panels, multi-region deployment, 
                and dedicated support for your organization.
              </p>
              <div className="flex flex-wrap gap-4 mt-6 justify-center md:justify-start">
                {["Multi-Region Nodes", "White-label Panel", "24/7 Monitoring", "Direct API Access"].map((feature) => (
                  <span key={feature} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <Magnetic>
                <button 
                  onClick={() => setShowContactModal(true)}
                  className="px-10 py-4 rounded-full border border-violet-400/30 text-white font-bold hover:bg-violet-500/10 transition-all"
                >
                  Contact Sales
                </button>
              </Magnetic>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Contact Sales Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card p-8 md:p-10 border-white/10 bg-[#0b0b0d] max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowContactModal(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
              
              <h3 className="text-2xl font-bold tracking-tighter mb-2">Contact Sales</h3>
              <p className="text-white/50 font-light mb-8">
                Reach out through any of these channels for enterprise inquiries.
              </p>
              
              <div className="space-y-4">
                <a
                  href="https://t.me/riturajprince"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <div className="p-3 rounded-full bg-[#229ED9]/10 group-hover:bg-[#229ED9]/20 transition-colors">
                    <svg className="w-6 h-6 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Telegram</p>
                    <p className="text-sm text-white/40">@riturajprince</p>
                  </div>
                </a>
                
                <a
                  href="https://instagram.com/theriturajprince"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <div className="p-3 rounded-full bg-pink-500/10 group-hover:bg-pink-500/20 transition-colors">
                    <svg className="w-6 h-6 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Instagram</p>
                    <p className="text-sm text-white/40">@theriturajprince</p>
                  </div>
                </a>
                
                <a
                  href="mailto:medicobhai@gmail.com"
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <div className="p-3 rounded-full bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
                    <svg className="w-6 h-6 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-white/40">medicobhai@gmail.com</p>
                  </div>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default Pricing;

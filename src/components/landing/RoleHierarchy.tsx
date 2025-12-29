import { motion } from "framer-motion";
import { Crown, Shield, User, Eye, ArrowDown } from "lucide-react";

const roles = [
  {
    icon: Crown,
    title: "Owner",
    level: "ROOT / L0",
    description: "Ultimate authority over the infrastructure.",
    color: "text-amber-400",
    glow: "bg-amber-400/20",
    capabilities: ["Global Infrastructure", "Admin Management", "Manual Premium Grants"]
  },
  {
    icon: Shield,
    title: "Administrator",
    level: "MODERATOR / L1",
    description: "System-wide oversight and abuse control.",
    color: "text-violet-400",
    glow: "bg-violet-400/20",
    capabilities: ["Abuse Reporting", "User Suspension", "Read-only Analytics"]
  },
  {
    icon: User,
    title: "Member",
    level: "TENANT / L2",
    description: "Panel owner with full management rights.",
    color: "text-teal-400",
    glow: "bg-teal-400/20",
    capabilities: ["Content Uploads", "Share Link Generation", "Personal Analytics"]
  },
  {
    icon: Eye,
    title: "End User",
    level: "CONSUMER / L3",
    description: "Content audience with isolated access.",
    color: "text-slate-400",
    glow: "bg-slate-400/20",
    capabilities: ["View Shared Assets", "Secure Downloads", "Zero Panel Access"]
  }
];

const RoleHierarchy = () => {
  return (
    <section className="relative py-32 px-6">
      <div className="container max-w-6xl mx-auto relative">
        
        {/* Section Header */}
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-semibold tracking-tighter mb-4"
          >
            Access <span className="text-white/40">Hierarchies.</span>
          </motion.h2>
          <p className="text-white/50 font-light tracking-wide uppercase text-[11px]">
            Strict Permission Isolation
          </p>
        </div>

        {/* The Vertical Flow */}
        <div className="relative flex flex-col items-center gap-4">
          
          {/* Subtle connecting spine */}
          <div className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-amber-500/20 via-teal-500/10 to-transparent" />

          {roles.map((role, index) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, type: "spring", stiffness: 100, damping: 20 }}
              className="w-full max-w-3xl z-10"
            >
              <div className="glass-card group relative p-8 md:p-10 border-white/5 bg-black/40 hover:bg-white/[0.03] transition-all duration-700">
                
                {/* Internal Glow Anchor */}
                <div className={`absolute top-0 right-0 w-32 h-32 ${role.glow} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  
                  {/* Icon & Level */}
                  <div className="flex flex-col items-center gap-3 min-w-[120px]">
                    <div className={`p-4 rounded-2xl bg-white/5 border border-white/10 ${role.color}`}>
                      <role.icon className="w-8 h-8" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] font-mono font-bold opacity-30 tracking-widest uppercase">
                      {role.level}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:block w-[1px] h-12 bg-white/5" />

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-medium mb-2 tracking-tight">{role.title}</h3>
                    <p className="text-white/50 text-sm mb-4 font-light leading-relaxed max-w-md">
                      {role.description}
                    </p>
                    
                    {/* Horizontal Capabilities */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {role.capabilities.map((cap) => (
                        <span key={cap} className="flex items-center gap-2 text-[11px] font-medium text-white/40">
                          <div className={`w-1 h-1 rounded-full ${role.color.replace('text', 'bg')}`} />
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20">
                    <ArrowDown className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RoleHierarchy;

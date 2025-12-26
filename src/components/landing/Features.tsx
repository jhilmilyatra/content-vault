import { motion } from "framer-motion";
import { 
  Shield, 
  Users, 
  BarChart3, 
  HardDrive, 
  Lock, 
  Globe,
  Zap,
  Eye
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Owner God Panel",
    description: "Complete infrastructure control with user management, manual premium grants, and global analytics.",
    color: "from-primary to-cyan-400"
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description: "Strict hierarchy with Owner, Admin, Member, and End User roles. Each with isolated permissions.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: HardDrive,
    title: "Multi-Tenant Storage",
    description: "Isolated storage per panel with configurable quotas, bandwidth limits, and usage tracking.",
    color: "from-orange-500 to-amber-400"
  },
  {
    icon: BarChart3,
    title: "Real-time Analytics",
    description: "Track downloads, bandwidth, active users, and revenue with comprehensive dashboards.",
    color: "from-emerald-500 to-teal-400"
  },
  {
    icon: Lock,
    title: "Advanced Link Controls",
    description: "Password protection, expiry dates, download limits, IP restrictions, and OTP access.",
    color: "from-rose-500 to-red-400"
  },
  {
    icon: Globe,
    title: "CDN Accelerated",
    description: "Global content delivery with signed URLs, hotlink protection, and edge caching.",
    color: "from-blue-500 to-indigo-400"
  },
  {
    icon: Eye,
    title: "Audit Logging",
    description: "Immutable, append-only logs for all actions. Complete compliance and security trail.",
    color: "from-violet-500 to-purple-400"
  },
  {
    icon: Zap,
    title: "Abuse Protection",
    description: "Rate limiting, bot detection, country blocking, and emergency kill switches.",
    color: "from-yellow-500 to-orange-400"
  }
];

const Features = () => {
  return (
    <section className="relative py-32 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(172_66%_50%/0.05),transparent_50%)]" />
      
      <div className="container max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Enterprise Features,{" "}
            <span className="gradient-text">Zero Compromise</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to run a professional content distribution platform
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group relative"
            >
              <div className="h-full p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} p-3 mb-4 shadow-lg`}>
                  <feature.icon className="w-full h-full text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;

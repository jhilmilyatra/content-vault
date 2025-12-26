import { motion } from "framer-motion";
import { Crown, Shield, User, Eye } from "lucide-react";

const roles = [
  {
    icon: Crown,
    title: "Owner (Root)",
    level: "Level 0",
    description: "Ultimate authority over the entire platform",
    capabilities: [
      "Full infrastructure control",
      "Create & manage admins/members",
      "Manual premium grants",
      "Global analytics & billing",
      "Security & abuse controls"
    ],
    color: "from-amber-400 to-orange-500",
    borderColor: "border-amber-500/30"
  },
  {
    icon: Shield,
    title: "Admin",
    level: "Level 1",
    description: "Support and moderation capabilities",
    capabilities: [
      "View all panels",
      "Suspend/unsuspend panels",
      "Handle abuse reports",
      "Read-only analytics"
    ],
    color: "from-violet-400 to-purple-500",
    borderColor: "border-violet-500/30"
  },
  {
    icon: User,
    title: "Member",
    level: "Level 2",
    description: "Panel owner with content management",
    capabilities: [
      "Upload & manage files",
      "Create folders",
      "Generate share links",
      "View own analytics"
    ],
    color: "from-primary to-cyan-400",
    borderColor: "border-primary/30"
  },
  {
    icon: Eye,
    title: "End User",
    level: "Level 3",
    description: "Content consumer with no panel access",
    capabilities: [
      "View shared content",
      "Download files",
      "No dashboard access"
    ],
    color: "from-slate-400 to-slate-500",
    borderColor: "border-slate-500/30"
  }
];

const RoleHierarchy = () => {
  return (
    <section className="relative py-32 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-card/50 to-background" />
      
      <div className="container max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Strict <span className="gradient-text">Role Hierarchy</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Clear separation of concerns with granular permission control at every level
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection lines */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/50 via-primary/30 to-slate-500/20 hidden lg:block" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-x-16">
            {roles.map((role, index) => (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className={`relative ${index % 2 === 0 ? 'lg:pr-8' : 'lg:pl-8'}`}
              >
                {/* Connector dot */}
                <div 
                  className={`absolute top-8 w-4 h-4 rounded-full bg-gradient-to-br ${role.color} shadow-lg hidden lg:block
                    ${index % 2 === 0 ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'}`}
                />
                
                <div className={`p-6 rounded-xl bg-card border ${role.borderColor} hover:border-opacity-60 transition-all duration-300`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.color} p-3.5 shadow-lg flex-shrink-0`}>
                      <role.icon className="w-full h-full text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-semibold text-foreground">{role.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {role.level}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{role.description}</p>
                      <ul className="space-y-2">
                        {role.capabilities.map((cap) => (
                          <li key={cap} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${role.color}`} />
                            {cap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoleHierarchy;

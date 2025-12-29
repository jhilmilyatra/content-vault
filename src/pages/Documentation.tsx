import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Github, Instagram, Code, Heart, Zap, Shield, Users, Send, Mail, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GlassCard } from "@/components/ios/GlassCard";
import { lightHaptic } from "@/lib/haptics";

const Documentation = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    lightHaptic();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message Sent!",
      description: "We'll get back to you as soon as possible.",
    });
    
    setFormData({ name: "", email: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(20,20,30,1)_0%,_rgba(11,11,13,1)_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-teal-500/5 to-transparent blur-[120px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="ios-glass border-b border-white/5 sticky top-0 z-50">
          <div className="container max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link 
                to="/" 
                className="flex items-center gap-3 text-white/70 hover:text-white transition-colors ios-press"
                onClick={() => lightHaptic()}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-sm font-light">Back to Home</span>
              </Link>
              <span className="text-xl font-bold tracking-tighter">CloudVault</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container max-w-4xl mx-auto px-6 py-20">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tighter mb-4">
              Documentation
            </h1>
            <p className="text-white/50 font-light max-w-lg mx-auto">
              Everything you need to know about CloudVault infrastructure
            </p>
          </motion.div>

          {/* Quick Start Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              Quick Start
            </h2>
            <GlassCard>
              <ol className="space-y-4 text-white/70 font-light">
                {[
                  "Create an account or sign in to your existing CloudVault account",
                  "Upload your files through the intuitive dashboard interface",
                  "Generate secure share links with optional password protection",
                  "Share your content with anyone, anywhere in the world"
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-teal-400 font-mono">0{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </GlassCard>
          </motion.section>

          {/* Features Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              Core Features
            </h2>
            <div className="grid gap-4">
              {[
                { title: "Secure File Storage", desc: "Enterprise-grade encryption for all your files" },
                { title: "Share Links", desc: "Generate password-protected, expiring share links" },
                { title: "Guest Portal", desc: "Dedicated portal for guest users to access shared content" },
                { title: "Real-time Chat", desc: "Communicate with guests directly through the platform" },
                { title: "Analytics", desc: "Track views, downloads, and bandwidth usage" },
                { title: "Multi-tenant", desc: "Isolated storage with role-based access control" },
              ].map((feature, i) => (
                <GlassCard key={i} variant="subtle" className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-teal-400 mt-2 shrink-0" />
                  <div>
                    <h3 className="font-medium mb-1 text-white">{feature.title}</h3>
                    <p className="text-sm text-white/50 font-light">{feature.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.section>

          {/* Role Hierarchy */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              User Roles
            </h2>
            <GlassCard className="space-y-6">
              {[
                { role: "Owner", level: "L0", desc: "Full infrastructure control, admin management, premium grants", color: "text-amber-400" },
                { role: "Admin", level: "L1", desc: "User moderation, abuse control, read-only analytics", color: "text-violet-400" },
                { role: "Member", level: "L2", desc: "Content uploads, share links, personal analytics", color: "text-teal-400" },
                { role: "Guest", level: "L3", desc: "View shared content, secure downloads", color: "text-slate-400" },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-6">
                  <span className={`font-mono text-xs ${r.color}`}>{r.level}</span>
                  <div className="flex-1">
                    <span className="font-medium text-white">{r.role}</span>
                    <span className="text-white/30 mx-3">—</span>
                    <span className="text-sm text-white/50 font-light">{r.desc}</span>
                  </div>
                </div>
              ))}
            </GlassCard>
          </motion.section>

          {/* DMCA Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              DMCA & Copyright
            </h2>
            <GlassCard>
              <p className="text-white/70 font-light mb-4">
                CloudVault respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). 
                If you believe your copyrighted work has been infringed upon, please contact us immediately.
              </p>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <Mail className="w-5 h-5 text-orange-400" strokeWidth={1.5} />
                <div>
                  <p className="text-sm text-white/50 font-light">Report copyright infringement:</p>
                  <a 
                    href="mailto:medicobhai@gmail.com" 
                    className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                  >
                    medicobhai@gmail.com
                  </a>
                </div>
              </div>
              <p className="text-xs text-white/30 mt-4 font-light">
                Please include detailed information about the copyrighted work and the infringing content in your report.
              </p>
            </GlassCard>
          </motion.section>

          {/* Contact Form Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Send className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              Contact Us
            </h2>
            <GlassCard>
              <p className="text-white/50 font-light mb-6">
                Have questions or feedback? Reach out through any of these channels:
              </p>
              
              {/* Social Links */}
              <div className="flex flex-wrap gap-4 mb-8">
                {[
                  { href: "https://t.me/riturajprince", icon: (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  ), label: "Telegram" },
                  { href: "https://instagram.com/theriturajprince", icon: <Instagram className="w-5 h-5" strokeWidth={1.5} />, label: "Instagram" },
                  { href: "https://github.com/riturajprince", icon: <Github className="w-5 h-5" strokeWidth={1.5} />, label: "GitHub" },
                  { href: "mailto:medicobhai@gmail.com", icon: <Mail className="w-5 h-5" strokeWidth={1.5} />, label: "Email" },
                ].map((link, i) => (
                  <a
                    key={i}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => lightHaptic()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06] transition-all ios-press"
                  >
                    {link.icon}
                    {link.label}
                  </a>
                ))}
              </div>
              
              <p className="text-white/50 font-light text-sm mb-6">Or send us a message directly:</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm text-white/50 mb-2 font-light">Name</label>
                    <input
                      type="text"
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="ios-input w-full"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm text-white/50 mb-2 font-light">Email</label>
                    <input
                      type="email"
                      id="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="ios-input w-full"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm text-white/50 mb-2 font-light">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="ios-input w-full resize-none"
                    placeholder="Your message..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="ios-button-primary w-full md:w-auto px-8 py-3 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4" strokeWidth={1.5} />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          </motion.section>

          {/* Credits Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              Credits
            </h2>
            <GlassCard>
              <div className="text-center">
                <p className="text-white/50 font-light mb-6">
                  CloudVault is designed and developed with passion
                </p>
                
                {/* Developer Card */}
                <div className="inline-block ios-glass-elevated rounded-2xl p-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center">
                      <Code className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                    
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-1 text-white">Ritu Raj Prince</h3>
                      <p className="text-sm text-white/40 font-light">Full Stack Developer</p>
                    </div>
                    
                    {/* Social Links */}
                    <div className="flex items-center gap-6 mt-4">
                      <a 
                        href="https://instagram.com/theriturajprince" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => lightHaptic()}
                        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group ios-press"
                      >
                        <Instagram className="w-5 h-5 group-hover:text-pink-400 transition-colors" strokeWidth={1.5} />
                        <span className="text-sm font-light">Instagram</span>
                      </a>
                      
                      <a 
                        href="https://github.com/riturajprince" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => lightHaptic()}
                        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group ios-press"
                      >
                        <Github className="w-5 h-5 group-hover:text-white transition-colors" strokeWidth={1.5} />
                        <span className="text-sm font-light">GitHub</span>
                      </a>
                    </div>
                  </div>
                </div>
                
                <p className="text-white/30 text-xs mt-8 font-light">
                  © 2024 CloudVault. All rights reserved.
                </p>
              </div>
            </GlassCard>
          </motion.section>
        </main>
      </div>
    </div>
  );
};

export default Documentation;

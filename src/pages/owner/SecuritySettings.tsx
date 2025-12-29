import { useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  Shield,
  Globe,
  AlertTriangle,
  Lock,
  Eye,
  Activity,
  Power,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GlassCard, GlassCardHeader, IosToggle } from "@/components/ios";
import { lightHaptic, mediumHaptic } from "@/lib/haptics";

const SecuritySettings = () => {
  const [settings, setSettings] = useState({
    rateLimiting: true,
    botDetection: true,
    hotlinkProtection: true,
    maintenanceMode: false,
    panicMode: false,
  });
  const [ipBlocklist, setIpBlocklist] = useState("");
  const [countryBlocklist, setCountryBlocklist] = useState("");

  const { toast } = useToast();

  const handleToggle = (key: keyof typeof settings, value: boolean) => {
    lightHaptic();
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast({
      title: "Setting Updated",
      description: `${key.replace(/([A-Z])/g, " $1")} has been ${value ? "enabled" : "disabled"}`,
    });
  };

  const handlePanicMode = () => {
    if (!settings.panicMode) {
      if (confirm("Are you sure you want to enable PANIC MODE? This will invalidate all active links.")) {
        mediumHaptic();
        setSettings((prev) => ({ ...prev, panicMode: true }));
        toast({
          title: "PANIC MODE ENABLED",
          description: "All active links have been invalidated",
          variant: "destructive",
        });
      }
    } else {
      lightHaptic();
      setSettings((prev) => ({ ...prev, panicMode: false }));
      toast({
        title: "Panic Mode Disabled",
        description: "System returned to normal operation",
      });
    }
  };

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Shield className="w-6 h-6 text-teal-400" />
            Security Settings
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Configure security features and abuse protection
          </p>
        </div>

        {/* Panic Mode Alert */}
        <motion.div
          className="animate-fade-up"
          style={{ animationDelay: "50ms" }}
        >
          <GlassCard 
            variant="elevated"
            className={settings.panicMode 
              ? "border-rose-500/50 bg-rose-500/10" 
              : "border-amber-500/30 bg-amber-500/5"
            }
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                settings.panicMode ? "bg-rose-500/20" : "bg-amber-500/20"
              }`}>
                <AlertTriangle className={`w-6 h-6 ${settings.panicMode ? "text-rose-400" : "text-amber-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white">Emergency Kill Switch</h3>
                <p className="text-sm text-white/50 mt-1">
                  Immediately invalidate all active share links and lock down the system
                </p>
                <button
                  onClick={handlePanicMode}
                  className={`mt-4 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    settings.panicMode 
                      ? "ios-button-secondary" 
                      : "bg-rose-500 text-white hover:bg-rose-400"
                  }`}
                >
                  {settings.panicMode ? "Disable Panic Mode" : "Enable PANIC MODE"}
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Security Features */}
        <motion.div
          className="space-y-3 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Protection Features</h2>
          
          <IosToggle
            checked={settings.rateLimiting}
            onCheckedChange={(value) => handleToggle("rateLimiting", value)}
            label="Rate Limiting"
            description="Limit API requests per user to prevent abuse"
          />
          
          <IosToggle
            checked={settings.botDetection}
            onCheckedChange={(value) => handleToggle("botDetection", value)}
            label="Bot Detection"
            description="Block automated scraping and bot traffic"
          />
          
          <IosToggle
            checked={settings.hotlinkProtection}
            onCheckedChange={(value) => handleToggle("hotlinkProtection", value)}
            label="Hotlink Protection"
            description="Prevent unauthorized embedding of files"
          />
          
          <IosToggle
            checked={settings.maintenanceMode}
            onCheckedChange={(value) => handleToggle("maintenanceMode", value)}
            label="Maintenance Mode"
            description="Temporarily disable public access for maintenance"
          />
        </motion.div>

        {/* IP Blocking */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "150ms" }}>
          <GlassCardHeader
            title="IP Blocklist"
            icon={<Globe className="w-5 h-5 text-teal-400" />}
          />
          <div className="space-y-4 mt-4">
            <p className="text-sm text-white/50">
              Block specific IP addresses from accessing the platform
            </p>
            <Textarea
              placeholder="Enter IP addresses (one per line)&#10;192.168.1.1&#10;10.0.0.0/8"
              value={ipBlocklist}
              onChange={(e) => setIpBlocklist(e.target.value)}
              className="min-h-[120px] font-mono text-sm ios-input resize-none"
            />
            <button className="ios-button-primary px-5 py-2.5 rounded-xl text-sm font-medium">
              Save Blocklist
            </button>
          </div>
        </GlassCard>

        {/* Country Blocking */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <GlassCardHeader
            title="Country Restrictions"
            icon={<Globe className="w-5 h-5 text-teal-400" />}
          />
          <div className="space-y-4 mt-4">
            <p className="text-sm text-white/50">
              Block access from specific countries (use ISO country codes)
            </p>
            <Input
              placeholder="e.g., CN, RU, KP (comma-separated)"
              value={countryBlocklist}
              onChange={(e) => setCountryBlocklist(e.target.value)}
              className="ios-input"
            />
            <button className="ios-button-primary px-5 py-2.5 rounded-xl text-sm font-medium">
              Save Restrictions
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </DashboardLayout>
  );
};

export default SecuritySettings;
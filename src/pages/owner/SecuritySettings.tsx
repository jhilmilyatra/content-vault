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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { IosList, IosListItem } from "@/components/ios/IosList";
import { staggerContainer, staggerItem } from "@/lib/motion";
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

  const handleToggle = (key: keyof typeof settings) => {
    lightHaptic();
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    toast({
      title: "Setting Updated",
      description: `${key.replace(/([A-Z])/g, " $1")} has been ${
        settings[key] ? "disabled" : "enabled"
      }`,
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

  const securityFeatures = [
    {
      key: "rateLimiting" as const,
      icon: <Activity className="w-5 h-5 text-primary" />,
      title: "Rate Limiting",
      subtitle: "Limit API requests per user",
    },
    {
      key: "botDetection" as const,
      icon: <Eye className="w-5 h-5 text-primary" />,
      title: "Bot Detection",
      subtitle: "Block automated scraping",
    },
    {
      key: "hotlinkProtection" as const,
      icon: <Lock className="w-5 h-5 text-primary" />,
      title: "Hotlink Protection",
      subtitle: "Prevent unauthorized embedding",
    },
    {
      key: "maintenanceMode" as const,
      icon: <Power className="w-5 h-5 text-amber-400" />,
      title: "Maintenance Mode",
      subtitle: "Temporarily disable access",
    },
  ];

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6 px-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            Security Settings
          </h1>
          <p className="text-muted-foreground mt-1 ml-13 text-sm">
            Configure security features and abuse protection
          </p>
        </div>

        {/* Panic Mode Alert */}
        <motion.div
          className="animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          <GlassCard 
            variant="elevated"
            className={settings.panicMode 
              ? "border-destructive/50 bg-destructive/10" 
              : "border-amber-500/30 bg-amber-500/5"
            }
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  settings.panicMode ? "bg-destructive/20" : "bg-amber-500/20"
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${settings.panicMode ? "text-destructive" : "text-amber-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">Emergency Kill Switch</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Immediately invalidate all active share links and lock down the system
                  </p>
                  <Button
                    variant={settings.panicMode ? "outline" : "destructive"}
                    onClick={handlePanicMode}
                    className="mt-4 rounded-xl h-11 ios-press"
                  >
                    {settings.panicMode ? "Disable Panic Mode" : "Enable PANIC MODE"}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Security Features */}
        <motion.div
          className="animate-fade-up"
          style={{ animationDelay: "0.1s" }}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <IosList>
            {securityFeatures.map((feature) => (
              <motion.div key={feature.key} variants={staggerItem}>
                <div className="flex items-center justify-between p-4 border-b border-border/20 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl ios-glass flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <div>
                      <Label className="text-base font-medium text-foreground">
                        {feature.title}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {feature.subtitle}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings[feature.key]}
                    onCheckedChange={() => handleToggle(feature.key)}
                  />
                </div>
              </motion.div>
            ))}
          </IosList>
        </motion.div>

        {/* IP Blocking */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <GlassCardHeader
            title="IP Blocklist"
            icon={<Globe className="w-5 h-5 text-primary" />}
          />
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Block specific IP addresses from accessing the platform
            </p>
            <Textarea
              placeholder="Enter IP addresses (one per line)&#10;192.168.1.1&#10;10.0.0.0/8"
              value={ipBlocklist}
              onChange={(e) => setIpBlocklist(e.target.value)}
              className="min-h-[120px] font-mono text-sm rounded-xl ios-glass border-0"
            />
            <Button className="rounded-xl h-11 ios-press w-full sm:w-auto">
              Save Blocklist
            </Button>
          </div>
        </GlassCard>

        {/* Country Blocking */}
        <GlassCard variant="elevated" className="animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <GlassCardHeader
            title="Country Restrictions"
            icon={<Globe className="w-5 h-5 text-primary" />}
          />
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Block access from specific countries (use ISO country codes)
            </p>
            <Input
              placeholder="e.g., CN, RU, KP (comma-separated)"
              value={countryBlocklist}
              onChange={(e) => setCountryBlocklist(e.target.value)}
              className="h-12 rounded-xl ios-glass border-0"
            />
            <Button className="rounded-xl h-11 ios-press w-full sm:w-auto">
              Save Restrictions
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </DashboardLayout>
  );
};

export default SecuritySettings;

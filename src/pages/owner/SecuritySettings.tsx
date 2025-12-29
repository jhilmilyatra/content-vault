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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/PageTransition";

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
        setSettings((prev) => ({ ...prev, panicMode: true }));
        toast({
          title: "PANIC MODE ENABLED",
          description: "All active links have been invalidated",
          variant: "destructive",
        });
      }
    } else {
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
      icon: Activity,
      title: "Rate Limiting",
      description: "Limit API requests per user to prevent abuse",
    },
    {
      key: "botDetection" as const,
      icon: Eye,
      title: "Bot Detection",
      description: "Detect and block automated scraping attempts",
    },
    {
      key: "hotlinkProtection" as const,
      icon: Lock,
      title: "Hotlink Protection",
      description: "Prevent unauthorized embedding of shared content",
    },
    {
      key: "maintenanceMode" as const,
      icon: Power,
      title: "Maintenance Mode",
      description: "Temporarily disable access for maintenance",
    },
  ];

  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10";

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <Shield className="w-6 h-6 text-teal-400" />
                Security Settings
              </h1>
              <p className="text-white/50">
                Configure security features and abuse protection
              </p>
            </div>
          </motion.div>

          {/* Panic Mode Alert */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={`border-2 ${settings.panicMode ? "border-rose-500/50 bg-rose-500/10" : "border-amber-500/30 bg-amber-500/5"}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                  Emergency Kill Switch
                </CardTitle>
                <CardDescription className="text-white/50">
                  Immediately invalidate all active share links and lock down the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant={settings.panicMode ? "outline" : "destructive"}
                  onClick={handlePanicMode}
                  className={settings.panicMode ? "border-white/10 text-white/70 hover:text-white hover:bg-white/10" : ""}
                >
                  {settings.panicMode ? "Disable Panic Mode" : "Enable PANIC MODE"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {securityFeatures.map((feature, index) => (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
              >
                <Card className={glassCard}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                          <feature.icon className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                          <Label className="text-base font-medium text-white">{feature.title}</Label>
                          <p className="text-sm text-white/50 mt-1">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={settings[feature.key]}
                        onCheckedChange={() => handleToggle(feature.key)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* IP Blocking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className={glassCard}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Globe className="w-5 h-5 text-teal-400" />
                  IP Blocklist
                </CardTitle>
                <CardDescription className="text-white/50">
                  Block specific IP addresses from accessing the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter IP addresses (one per line)&#10;192.168.1.1&#10;10.0.0.0/8"
                  value={ipBlocklist}
                  onChange={(e) => setIpBlocklist(e.target.value)}
                  className="min-h-[120px] font-mono text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
                <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white">
                  Save Blocklist
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Country Blocking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className={glassCard}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Globe className="w-5 h-5 text-teal-400" />
                  Country Restrictions
                </CardTitle>
                <CardDescription className="text-white/50">
                  Block access from specific countries (use ISO country codes)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="e.g., CN, RU, KP (comma-separated)"
                  value={countryBlocklist}
                  onChange={(e) => setCountryBlocklist(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
                <Button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white">
                  Save Restrictions
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default SecuritySettings;
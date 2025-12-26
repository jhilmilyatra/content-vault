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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Security Settings
            </h1>
            <p className="text-muted-foreground">
              Configure security features and abuse protection
            </p>
          </div>
        </div>

        {/* Panic Mode Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-2 ${settings.panicMode ? "border-destructive bg-destructive/5" : "border-amber-500/30"}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Emergency Kill Switch
              </CardTitle>
              <CardDescription>
                Immediately invalidate all active share links and lock down the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant={settings.panicMode ? "outline" : "destructive"}
                onClick={handlePanicMode}
                className="w-full sm:w-auto"
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
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <feature.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <Label className="text-base font-medium">{feature.title}</Label>
                        <p className="text-sm text-muted-foreground mt-1">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              IP Blocklist
            </CardTitle>
            <CardDescription>
              Block specific IP addresses from accessing the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter IP addresses (one per line)&#10;192.168.1.1&#10;10.0.0.0/8"
              value={ipBlocklist}
              onChange={(e) => setIpBlocklist(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
            <Button>Save Blocklist</Button>
          </CardContent>
        </Card>

        {/* Country Blocking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Country Restrictions
            </CardTitle>
            <CardDescription>
              Block access from specific countries (use ISO country codes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="e.g., CN, RU, KP (comma-separated)"
              value={countryBlocklist}
              onChange={(e) => setCountryBlocklist(e.target.value)}
            />
            <Button>Save Restrictions</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SecuritySettings;

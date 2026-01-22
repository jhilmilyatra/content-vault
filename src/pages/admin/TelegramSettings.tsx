import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Send,
  Bot,
  MessageCircle,
  Headphones,
  ExternalLink,
  Save,
  RefreshCw,
  Link2,
  Crown,
} from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SkeletonTable } from "@/components/ios/SkeletonLoader";

interface TelegramSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

const SETTING_ICONS: Record<string, typeof Send> = {
  telegram_premium_link: Crown,
  telegram_bot_link: Bot,
  telegram_channel_link: MessageCircle,
  telegram_support_link: Headphones,
};

const SETTING_LABELS: Record<string, string> = {
  telegram_premium_link: "Telegram Premium Link",
  telegram_bot_link: "Upload Bot Link",
  telegram_channel_link: "Main Channel Link",
  telegram_support_link: "Support Contact Link",
};

const TelegramSettings = () => {
  const [settings, setSettings] = useState<TelegramSetting[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { role } = useAuth();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("id, key, value, description")
        .eq("category", "telegram")
        .order("key");

      if (error) throw error;

      setSettings(data || []);
      const initialEdits: Record<string, string> = {};
      (data || []).forEach((s) => {
        initialEdits[s.key] = s.value;
      });
      setEditedSettings(initialEdits);
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to load Telegram settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (role !== "owner" && role !== "admin") {
      toast({
        title: "Permission Denied",
        description: "Only owners can update settings",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updates = settings
        .filter((s) => editedSettings[s.key] !== s.value)
        .map((s) => ({
          id: s.id,
          key: s.key,
          value: editedSettings[s.key],
          category: "telegram",
          updated_at: new Date().toISOString(),
        }));

      if (updates.length === 0) {
        toast({ title: "No changes", description: "No settings were modified" });
        setSaving(false);
        return;
      }

      for (const update of updates) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value: update.value, updated_at: update.updated_at })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: `Updated ${updates.length} Telegram link(s)`,
      });

      fetchSettings();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings.some((s) => editedSettings[s.key] !== s.value);

  return (
    <DashboardLayout>
      <PageTransition className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3 tracking-tight">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Send className="w-5 h-5 text-white" />
              </div>
              Telegram Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure Telegram redirect links visible to users
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSettings}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges || role !== "owner"}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard>
            <GlassCardHeader
              title="Telegram Redirect Links"
              icon={<Link2 className="w-5 h-5 text-sky-400" />}
            />

            {loading ? (
              <SkeletonTable rows={4} />
            ) : settings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No Telegram settings configured</p>
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {settings.map((setting, index) => {
                  const Icon = SETTING_ICONS[setting.key] || Link2;
                  const label = SETTING_LABELS[setting.key] || setting.key;

                  return (
                    <motion.div
                      key={setting.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-sm font-medium text-foreground">
                            {label}
                          </Label>
                          {setting.description && (
                            <p className="text-xs text-muted-foreground">
                              {setting.description}
                            </p>
                          )}
                        </div>
                        <a
                          href={editedSettings[setting.key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                      </div>
                      <Input
                        value={editedSettings[setting.key] || ""}
                        onChange={(e) => handleInputChange(setting.key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="ios-input"
                        disabled={role !== "owner"}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}

            {role !== "owner" && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  Only owners can modify Telegram settings. Contact the owner to request changes.
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard variant="elevated">
            <GlassCardHeader
              title="Link Preview"
              icon={<ExternalLink className="w-5 h-5 text-teal-400" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {settings.map((setting) => {
                const Icon = SETTING_ICONS[setting.key] || Link2;
                const label = SETTING_LABELS[setting.key] || setting.key;

                return (
                  <a
                    key={setting.id}
                    href={editedSettings[setting.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {editedSettings[setting.key] || "Not set"}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default TelegramSettings;
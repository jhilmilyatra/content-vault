import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  ToggleLeft,
  Save,
  RefreshCw,
  Users,
  Link,
  Lock,
  Clock,
  Download,
  Video,
  Send,
  MessageCircle,
  BarChart3,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonTable } from "@/components/ios/SkeletonLoader";

const SETTING_ICONS: Record<string, typeof ToggleLeft> = {
  feature_guest_registration: Users,
  feature_public_shares: Link,
  feature_password_shares: Lock,
  feature_expiring_links: Clock,
  feature_download_limits: Download,
  feature_video_streaming: Video,
  feature_telegram_upload: Send,
  feature_member_chat: MessageCircle,
  feature_owner_chat: MessageCircle,
  feature_analytics: BarChart3,
  maintenance_mode: AlertTriangle,
  maintenance_message: AlertTriangle,
};

const SETTING_LABELS: Record<string, string> = {
  feature_guest_registration: "Guest Registration",
  feature_public_shares: "Public Share Links",
  feature_password_shares: "Password-Protected Shares",
  feature_expiring_links: "Expiring Links",
  feature_download_limits: "Download Limits",
  feature_video_streaming: "Video Streaming",
  feature_telegram_upload: "Telegram Uploads",
  feature_member_chat: "Member-Guest Chat",
  feature_owner_chat: "Owner-Member Chat",
  feature_analytics: "Analytics Dashboard",
  maintenance_mode: "Maintenance Mode",
  maintenance_message: "Maintenance Message",
};

const FeatureFlags = () => {
  const { role } = useAuth();
  const {
    settings,
    editedSettings,
    loading,
    saving,
    hasChanges,
    fetchSettings,
    handleInputChange,
    handleSave,
  } = useSystemSettings("features");

  const isOwner = role === "owner";

  const onSave = () => handleSave("owner", role);

  const toggleFeature = (key: string) => {
    const currentValue = editedSettings[key] === "true";
    handleInputChange(key, (!currentValue).toString());
  };

  // Separate maintenance settings from feature flags
  const featureSettings = settings.filter((s) => s.key.startsWith("feature_"));
  const maintenanceSettings = settings.filter((s) => s.key.startsWith("maintenance_"));

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              Feature Flags
            </h1>
            <p className="text-muted-foreground mt-1">
              Enable or disable application features
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
              onClick={onSave}
              disabled={saving || !hasChanges || !isOwner}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>

        {/* Maintenance Mode (Priority) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <GlassCard variant={editedSettings["maintenance_mode"] === "true" ? "elevated" : "default"}>
            <GlassCardHeader
              title="Maintenance Mode"
              icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            />

            {loading ? (
              <SkeletonTable rows={2} />
            ) : (
              <div className="space-y-4 mt-4">
                {maintenanceSettings.map((setting) => {
                  const Icon = SETTING_ICONS[setting.key] || ToggleLeft;
                  const label = SETTING_LABELS[setting.key] || setting.key;
                  const isToggle = setting.key === "maintenance_mode";
                  const isEnabled = editedSettings[setting.key] === "true";

                  if (isToggle) {
                    return (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isEnabled ? "bg-red-500/20" : "bg-amber-500/10"
                          }`}>
                            <Icon className={`w-5 h-5 ${isEnabled ? "text-red-400" : "text-amber-400"}`} />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-foreground">
                              {label}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {isEnabled 
                                ? "App is in maintenance mode - users cannot access" 
                                : "App is running normally"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleFeature(setting.key)}
                          disabled={!isOwner}
                          className="data-[state=checked]:bg-red-500"
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={setting.id} className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">
                        {label}
                      </Label>
                      <Textarea
                        value={editedSettings[setting.key] || ""}
                        onChange={(e) => handleInputChange(setting.key, e.target.value)}
                        placeholder="Enter maintenance message..."
                        className="ios-input min-h-[80px] resize-y"
                        disabled={!isOwner}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Feature Toggles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard>
            <GlassCardHeader
              title="Feature Toggles"
              icon={<ToggleLeft className="w-5 h-5 text-orange-400" />}
            />

            {loading ? (
              <SkeletonTable rows={10} />
            ) : featureSettings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ToggleLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No feature flags configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {featureSettings.map((setting, index) => {
                  const Icon = SETTING_ICONS[setting.key] || ToggleLeft;
                  const label = SETTING_LABELS[setting.key] || setting.key;
                  const isEnabled = editedSettings[setting.key] === "true";

                  return (
                    <motion.div
                      key={setting.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                        isEnabled
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-white/[0.02] border-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isEnabled ? "bg-emerald-500/20" : "bg-white/[0.05]"
                        }`}>
                          <Icon className={`w-5 h-5 ${isEnabled ? "text-emerald-400" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-foreground">
                            {label}
                          </Label>
                          {setting.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {setting.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleFeature(setting.key)}
                        disabled={!isOwner}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!isOwner && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  Only owners can modify feature flags.
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default FeatureFlags;

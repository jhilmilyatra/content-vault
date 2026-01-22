import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  Palette,
  Type,
  Image,
  FileImage,
  Save,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SkeletonTable } from "@/components/ios/SkeletonLoader";

const SETTING_ICONS: Record<string, typeof Palette> = {
  app_name: Type,
  app_tagline: Sparkles,
  primary_color: Palette,
  accent_color: Palette,
  logo_url: Image,
  favicon_url: FileImage,
  footer_text: Type,
};

const SETTING_LABELS: Record<string, string> = {
  app_name: "Application Name",
  app_tagline: "Tagline / Slogan",
  primary_color: "Primary Color",
  accent_color: "Accent Color",
  logo_url: "Logo URL",
  favicon_url: "Favicon URL",
  footer_text: "Footer Text",
};

const BrandingSettings = () => {
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
    getSetting,
  } = useSystemSettings("branding");

  const isOwner = role === "owner";

  const onSave = () => handleSave("owner", role);

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Palette className="w-5 h-5 text-white" />
              </div>
              Branding Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Customize your application's look and feel
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

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard>
            <GlassCardHeader
              title="Brand Identity"
              icon={<Sparkles className="w-5 h-5 text-violet-400" />}
            />

            {loading ? (
              <SkeletonTable rows={7} />
            ) : settings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No branding settings configured</p>
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {settings.map((setting, index) => {
                  const Icon = SETTING_ICONS[setting.key] || Palette;
                  const label = SETTING_LABELS[setting.key] || setting.key;
                  const isColor = setting.key.includes("color");

                  return (
                    <motion.div
                      key={setting.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-violet-400" />
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
                        {isColor && editedSettings[setting.key] && (
                          <div
                            className="w-8 h-8 rounded-lg border border-white/10"
                            style={{ backgroundColor: editedSettings[setting.key] }}
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isColor && (
                          <Input
                            type="color"
                            value={editedSettings[setting.key] || "#000000"}
                            onChange={(e) => handleInputChange(setting.key, e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                            disabled={!isOwner}
                          />
                        )}
                        <Input
                          value={editedSettings[setting.key] || ""}
                          onChange={(e) => handleInputChange(setting.key, e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()}`}
                          className="ios-input flex-1"
                          disabled={!isOwner}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!isOwner && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  Only owners can modify branding settings.
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
              title="Brand Preview"
              icon={<Image className="w-5 h-5 text-teal-400" />}
            />
            <div className="mt-4 p-6 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-4 mb-4">
                {getSetting("logo_url") ? (
                  <img
                    src={getSetting("logo_url")}
                    alt="Logo"
                    className="w-12 h-12 rounded-xl object-contain"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: getSetting("primary_color") || "#0ea5e9" }}
                  >
                    {getSetting("app_name")?.charAt(0) || "C"}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: getSetting("primary_color") || "#0ea5e9" }}>
                    {getSetting("app_name") || "CloudVault"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getSetting("app_tagline") || "Secure Cloud Storage"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: getSetting("primary_color") || "#0ea5e9" }}
                >
                  Primary Button
                </div>
                <div
                  className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: getSetting("accent_color") || "#8b5cf6" }}
                >
                  Accent Button
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.05] text-xs text-muted-foreground">
                {getSetting("footer_text") || "© 2024 CloudVault. All rights reserved."}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default BrandingSettings;

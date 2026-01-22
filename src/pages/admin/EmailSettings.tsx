import { motion } from "framer-motion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { PageTransition } from "@/components/ui/PageTransition";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  Mail,
  Save,
  RefreshCw,
  User,
  AtSign,
  FileText,
  Bell,
  Clock,
  Sparkles,
} from "lucide-react";
import { GlassCard, GlassCardHeader } from "@/components/ios/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonTable } from "@/components/ios/SkeletonLoader";

const SETTING_ICONS: Record<string, typeof Mail> = {
  email_welcome_subject: Sparkles,
  email_welcome_body: FileText,
  email_password_reset_subject: FileText,
  email_share_notification_subject: Bell,
  email_share_notification_body: FileText,
  email_expiry_warning_subject: Clock,
  email_sender_name: User,
  email_sender_address: AtSign,
};

const SETTING_LABELS: Record<string, string> = {
  email_welcome_subject: "Welcome Email Subject",
  email_welcome_body: "Welcome Email Body",
  email_password_reset_subject: "Password Reset Subject",
  email_share_notification_subject: "Share Notification Subject",
  email_share_notification_body: "Share Notification Body",
  email_expiry_warning_subject: "Expiry Warning Subject",
  email_sender_name: "Sender Name",
  email_sender_address: "Sender Email Address",
};

const EmailSettings = () => {
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
  } = useSystemSettings("email");

  const isOwner = role === "owner";

  const onSave = () => handleSave("owner", role);

  const isBodyField = (key: string) => key.includes("body");

  // Group settings by type
  const senderSettings = settings.filter((s) => s.key.includes("sender"));
  const templateSettings = settings.filter((s) => !s.key.includes("sender"));

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Mail className="w-5 h-5 text-white" />
              </div>
              Email Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure email templates and sender information
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

        {/* Sender Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard>
            <GlassCardHeader
              title="Sender Configuration"
              icon={<User className="w-5 h-5 text-rose-400" />}
            />

            {loading ? (
              <SkeletonTable rows={2} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {senderSettings.map((setting, index) => {
                  const Icon = SETTING_ICONS[setting.key] || Mail;
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
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-rose-400" />
                        </div>
                        <Label className="text-sm font-medium text-foreground">
                          {label}
                        </Label>
                      </div>
                      <Input
                        value={editedSettings[setting.key] || ""}
                        onChange={(e) => handleInputChange(setting.key, e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="ios-input"
                        disabled={!isOwner}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Email Templates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard>
            <GlassCardHeader
              title="Email Templates"
              icon={<FileText className="w-5 h-5 text-pink-400" />}
            />

            {loading ? (
              <SkeletonTable rows={6} />
            ) : (
              <div className="space-y-6 mt-4">
                {templateSettings.map((setting, index) => {
                  const Icon = SETTING_ICONS[setting.key] || Mail;
                  const label = SETTING_LABELS[setting.key] || setting.key;
                  const isBody = isBodyField(setting.key);

                  return (
                    <motion.div
                      key={setting.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-pink-400" />
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
                      </div>
                      {isBody ? (
                        <Textarea
                          value={editedSettings[setting.key] || ""}
                          onChange={(e) => handleInputChange(setting.key, e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()}`}
                          className="ios-input min-h-[100px] resize-y"
                          disabled={!isOwner}
                        />
                      ) : (
                        <Input
                          value={editedSettings[setting.key] || ""}
                          onChange={(e) => handleInputChange(setting.key, e.target.value)}
                          placeholder={`Enter ${label.toLowerCase()}`}
                          className="ios-input"
                          disabled={!isOwner}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!isOwner && (
              <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  Only owners can modify email settings.
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default EmailSettings;

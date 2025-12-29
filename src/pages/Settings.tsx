import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Bell, Save, Loader2, Key, Copy, RefreshCw, Check, Bot, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard, IosSegmentedControl, IosToggle } from '@/components/ios';
import { lightHaptic, mediumHaptic } from '@/lib/haptics';

const Settings = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [downloadNotifications, setDownloadNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  
  // API Key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    mediumHaptic();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    mediumHaptic();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = () => {
    mediumHaptic();
    localStorage.setItem('preferences', JSON.stringify({
      emailNotifications,
      downloadNotifications,
      weeklyReports,
    }));
    toast.success('Preferences saved');
  };

  const generateApiKey = () => {
    if (!user) return;
    lightHaptic();
    const secret = crypto.randomUUID().replace(/-/g, '');
    const key = `${user.id}:${secret}`;
    setApiKey(key);
    toast.success('API key generated! Save it securely.');
  };

  const copyApiKey = async () => {
    if (!apiKey) return;
    lightHaptic();
    await navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const tabSegments = [
    { value: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { value: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { value: 'api', label: 'API', icon: <Key className="w-4 h-4" /> },
    { value: 'preferences', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          {isMobile && (
            <button
              onClick={() => {
                lightHaptic();
                navigate('/dashboard');
              }}
              className="h-9 w-9 flex-shrink-0 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-white/50 text-sm">Manage your account settings and preferences</p>
          </div>
        </motion.div>

        {/* iOS Segmented Control for Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <IosSegmentedControl
            segments={tabSegments}
            value={activeTab}
            onChange={setActiveTab}
            size="md"
            className="w-full lg:w-auto"
          />
        </motion.div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Profile Information</h2>
                <p className="text-sm text-white/40">Update your personal information and avatar</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 border-2 border-white/10">
                    <AvatarImage src={avatarUrl} alt={fullName} />
                    <AvatarFallback className="bg-gradient-to-br from-teal-500 to-blue-600 text-white text-lg">{getInitials(fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="avatar" className="text-white/70 text-sm">Avatar URL</Label>
                    <Input
                      id="avatar"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="ios-input"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-white/70 text-sm">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="ios-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="ios-input opacity-50"
                    />
                    <p className="text-xs text-white/30">Email cannot be changed</p>
                  </div>
                </div>

                <button 
                  onClick={handleUpdateProfile} 
                  disabled={loading} 
                  className="ios-button-primary px-6 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Change Password</h2>
                <p className="text-sm text-white/40">Update your password to keep your account secure</p>
              </div>
              
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white/70 text-sm">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="ios-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white/70 text-sm">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="ios-input"
                  />
                </div>
                <button 
                  onClick={handleChangePassword} 
                  disabled={loading || !newPassword} 
                  className="ios-button-primary px-6 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Update Password
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Active Sessions</h2>
                <p className="text-sm text-white/40">Manage your active login sessions</p>
              </div>
              
              <div className="flex items-center justify-between rounded-xl ios-glass-light p-4">
                <div className="space-y-1">
                  <p className="font-medium text-white">Current Session</p>
                  <p className="text-sm text-white/40">
                    Logged in since {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" />
                  <span className="text-sm text-white/50">Active</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">API Access</h2>
                <p className="text-sm text-white/40">Generate an API key for integrations</p>
              </div>
              
              {apiKey ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl ios-glass-light">
                    <Label className="text-xs text-white/40">Your API Key</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={apiKey}
                        readOnly
                        className="font-mono text-xs ios-input"
                      />
                      <button 
                        onClick={copyApiKey}
                        className="ios-button-secondary p-3 rounded-xl"
                      >
                        {apiKeyCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      ⚠️ This key will only be shown once. Store it securely!
                    </p>
                  </div>
                  <button 
                    onClick={generateApiKey} 
                    className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Generate New Key
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">
                    Generate an API key to upload files programmatically via our Telegram bot or any HTTP client.
                  </p>
                  <button 
                    onClick={generateApiKey} 
                    className="ios-button-primary px-6 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Generate API Key
                  </button>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">API Documentation</h2>
                <p className="text-sm text-white/40">How to use the upload API</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm">Endpoint</Label>
                  <code className="block p-3 rounded-xl ios-glass-light text-sm font-mono text-teal-400 break-all">
                    POST https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/telegram-upload
                  </code>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm">Headers</Label>
                  <code className="block p-3 rounded-xl ios-glass-light text-sm font-mono text-white/70">
                    x-api-key: YOUR_API_KEY<br/>
                    Content-Type: application/json
                  </code>
                </div>
                <div className="pt-4 border-t border-white/[0.05]">
                  <button 
                    onClick={() => {
                      lightHaptic();
                      window.location.href = '/dashboard/telegram-guide';
                    }} 
                    className="ios-button-secondary px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                  >
                    <Bot className="h-4 w-4" />
                    View Telegram Bot Guide
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Notifications</h2>
                <p className="text-sm text-white/40">Configure your notification preferences</p>
              </div>
              
              <div className="space-y-3">
                <IosToggle
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  label="Email Notifications"
                  description="Receive email updates about your account"
                />
                <IosToggle
                  checked={downloadNotifications}
                  onCheckedChange={setDownloadNotifications}
                  label="Download Alerts"
                  description="Get notified when files are downloaded"
                />
                <IosToggle
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                  label="Weekly Reports"
                  description="Receive weekly analytics summaries"
                />
                
                <div className="pt-4">
                  <button 
                    onClick={handleSavePreferences} 
                    className="ios-button-primary px-6 py-3 rounded-xl text-sm font-medium inline-flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Preferences
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default Settings;
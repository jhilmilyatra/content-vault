import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Bell, Save, Loader2, Key, Copy, RefreshCw, Check, Bot, Server, HardDrive, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageTransition, staggerContainer, staggerItem } from '@/components/ui/PageTransition';

const Settings = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  
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
    localStorage.setItem('preferences', JSON.stringify({
      emailNotifications,
      downloadNotifications,
      weeklyReports,
    }));
    toast.success('Preferences saved');
  };

  const generateApiKey = () => {
    if (!user) return;
    const secret = crypto.randomUUID().replace(/-/g, '');
    const key = `${user.id}:${secret}`;
    setApiKey(key);
    toast.success('API key generated! Save it securely.');
  };

  const copyApiKey = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    toast.success('API key copied to clipboard');
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Glass card style
  const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl";

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="h-9 w-9 flex-shrink-0 text-white/50 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-white/50 text-sm sm:text-base">Manage your account settings and preferences</p>
          </div>
        </motion.div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px] bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="profile" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 rounded-lg gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
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
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-teal-500/50"
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
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-teal-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-white/5 border-white/10 text-white/50"
                    />
                    <p className="text-xs text-white/30">Email cannot be changed</p>
                  </div>
                </div>

                <Button 
                  onClick={handleUpdateProfile} 
                  disabled={loading} 
                  className="gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white shadow-lg shadow-teal-500/20"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
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
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-teal-500/50"
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
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-teal-500/50"
                  />
                </div>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={loading || !newPassword} 
                  className="gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white shadow-lg shadow-teal-500/20"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Update Password
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Active Sessions</h2>
                <p className="text-sm text-white/40">Manage your active login sessions</p>
              </div>
              
              <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="space-y-1">
                  <p className="font-medium text-white">Current Session</p>
                  <p className="text-sm text-white/40">
                    Logged in since {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                  <span className="text-sm text-white/50">Active</span>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">API Access</h2>
                <p className="text-sm text-white/40">Generate an API key for integrations</p>
              </div>
              
              {apiKey ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <Label className="text-xs text-white/40">Your API Key</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={apiKey}
                        readOnly
                        className="font-mono text-xs bg-white/5 border-white/10 text-white"
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={copyApiKey}
                        className="border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        {apiKeyCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-400">
                      ⚠️ This key will only be shown once. Store it securely!
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={generateApiKey} 
                    className="gap-2 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Generate New Key
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">
                    Generate an API key to upload files programmatically via our Telegram bot or any HTTP client.
                  </p>
                  <Button 
                    onClick={generateApiKey} 
                    className="gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white shadow-lg shadow-teal-500/20"
                  >
                    <Key className="h-4 w-4" />
                    Generate API Key
                  </Button>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">API Documentation</h2>
                <p className="text-sm text-white/40">How to use the upload API</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm">Endpoint</Label>
                  <code className="block p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-teal-400 break-all">
                    POST https://dgmxndvvsbjjbnoibaid.supabase.co/functions/v1/telegram-upload
                  </code>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm">Headers</Label>
                  <code className="block p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-mono text-white/70">
                    x-api-key: YOUR_API_KEY<br/>
                    Content-Type: application/json
                  </code>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/dashboard/telegram-guide'} 
                    className="gap-2 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Bot className="h-4 w-4" />
                    View Telegram Bot Guide
                  </Button>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${glassCard} p-6 sm:p-8`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">Notifications</h2>
                <p className="text-sm text-white/40">Configure your notification preferences</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-white">Email Notifications</Label>
                    <p className="text-sm text-white/40">Receive email updates about your account</p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-white">Download Alerts</Label>
                    <p className="text-sm text-white/40">Get notified when files are downloaded</p>
                  </div>
                  <Switch
                    checked={downloadNotifications}
                    onCheckedChange={setDownloadNotifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-white">Weekly Reports</Label>
                    <p className="text-sm text-white/40">Receive weekly analytics summaries</p>
                  </div>
                  <Switch
                    checked={weeklyReports}
                    onCheckedChange={setWeeklyReports}
                  />
                </div>
                <Button 
                  onClick={handleSavePreferences} 
                  className="gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white shadow-lg shadow-teal-500/20"
                >
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default Settings;

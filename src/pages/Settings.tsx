import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  User, 
  Lock, 
  Bell, 
  Save, 
  Loader2, 
  Key, 
  Copy, 
  RefreshCw, 
  Check, 
  CreditCard,
  Crown,
  HardDrive,
  Server,
  ChevronRight,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageTransition } from '@/components/ui/PageTransition';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import CacheManagement from '@/components/settings/CacheManagement';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/fileService';

// Sub-navigation items
const settingsNav = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'preferences', label: 'Preferences', icon: Bell },
  { id: 'api', label: 'API', icon: Key },
];

const Settings = () => {
  const { user, profile, subscription } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  
  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [downloadNotifications, setDownloadNotifications] = useState(true);
  
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
      toast.success('Profile updated');
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
      toast.success('Password changed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = () => {
    if (!user) return;
    const secret = crypto.randomUUID().replace(/-/g, '');
    const key = `${user.id}:${secret}`;
    setApiKey(key);
    toast.success('API key generated');
  };

  const copyApiKey = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    toast.success('Copied');
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Calculate storage
  const storageUsedBytes = 0; // Would come from usage metrics
  const storageLimitBytes = (subscription?.storage_limit_gb || 1) * 1024 * 1024 * 1024;
  const storagePercentage = Math.min((storageUsedBytes / storageLimitBytes) * 100, 100);

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="max-w-4xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account</p>
          </motion.div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Sub-navigation */}
            <motion.nav 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="md:w-48 flex-shrink-0"
            >
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                {settingsNav.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors",
                      activeSection === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.nav>

            {/* Content */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex-1 space-y-6"
            >
              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="bg-card border border-border rounded-lg p-5 space-y-5">
                  <div>
                    <h2 className="text-base font-medium mb-1">Profile</h2>
                    <p className="text-sm text-muted-foreground">Your personal information</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={avatarUrl} alt={fullName} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {getInitials(fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="avatar" className="text-sm">Avatar URL</Label>
                      <Input
                        id="avatar"
                        placeholder="https://example.com/avatar.jpg"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="h-9 opacity-50"
                      />
                    </div>
                  </div>

                  <Button onClick={handleUpdateProfile} disabled={loading} size="sm">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                    <div>
                      <h2 className="text-base font-medium mb-1">Password</h2>
                      <p className="text-sm text-muted-foreground">Change your password</p>
                    </div>
                    
                    <div className="grid gap-3 max-w-sm">
                      <div className="space-y-1.5">
                        <Label htmlFor="newPassword" className="text-sm">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Button 
                        onClick={handleChangePassword} 
                        disabled={loading || !newPassword}
                        size="sm"
                        className="w-fit"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Update Password
                      </Button>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-medium mb-1">Sessions</h2>
                      <p className="text-sm text-muted-foreground">Manage active sessions</p>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">Current Session</p>
                        <p className="text-xs text-muted-foreground">
                          Logged in {new Date().toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-muted-foreground">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Section */}
              {activeSection === 'billing' && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-medium mb-1">Current Plan</h2>
                      <p className="text-sm text-muted-foreground">Your subscription details</p>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          subscription?.plan === 'premium' ? "bg-primary/10" : "bg-muted"
                        )}>
                          <Crown className={cn(
                            "w-5 h-5",
                            subscription?.plan === 'premium' ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {subscription?.plan || 'Free'} Plan
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {subscription?.storage_limit_gb || 1} GB Storage • {subscription?.bandwidth_limit_gb || 10} GB Bandwidth
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/dashboard/plans')}
                      >
                        {subscription?.plan === 'premium' ? 'Manage' : 'Upgrade'}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Storage Used</span>
                        <span className="font-medium">
                          {formatFileSize(storageUsedBytes)} / {subscription?.storage_limit_gb || 1} GB
                        </span>
                      </div>
                      <Progress value={storagePercentage} className="h-1.5" />
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-medium mb-1">Payment Method</h2>
                        <p className="text-sm text-muted-foreground">No payment method on file</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Add Card
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Storage Section */}
              {activeSection === 'storage' && (
                <CacheManagement />
              )}

              {/* Preferences Section */}
              {activeSection === 'preferences' && (
                <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                  <div>
                    <h2 className="text-base font-medium mb-1">Notifications</h2>
                    <p className="text-sm text-muted-foreground">Configure alerts</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Email Notifications</p>
                        <p className="text-xs text-muted-foreground">Receive email updates</p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Download Alerts</p>
                        <p className="text-xs text-muted-foreground">Get notified when files are downloaded</p>
                      </div>
                      <Switch
                        checked={downloadNotifications}
                        onCheckedChange={setDownloadNotifications}
                      />
                    </div>
                  </div>

                  <Button 
                    size="sm"
                    onClick={() => toast.success('Preferences saved')}
                  >
                    Save Preferences
                  </Button>
                </div>
              )}

              {/* API Section */}
              {activeSection === 'api' && (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-medium mb-1">API Access</h2>
                      <p className="text-sm text-muted-foreground">Generate API keys for integrations</p>
                    </div>
                    
                    {apiKey ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input value={apiKey} readOnly className="font-mono text-xs h-9" />
                          <Button variant="outline" size="icon" className="h-9 w-9" onClick={copyApiKey}>
                            {apiKeyCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-amber-500">
                          ⚠️ Save this key securely. It won't be shown again.
                        </p>
                        <Button variant="outline" size="sm" onClick={generateApiKey}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate New
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Generate a key to upload files via API or Telegram bot.
                        </p>
                        <Button size="sm" onClick={generateApiKey}>
                          <Key className="h-4 w-4 mr-2" />
                          Generate Key
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-lg p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-medium mb-1">Documentation</h2>
                      <p className="text-sm text-muted-foreground">API endpoint details</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Endpoint</Label>
                        <code className="block mt-1 p-2 rounded bg-muted text-xs font-mono break-all">
                          POST /functions/v1/telegram-upload
                        </code>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Headers</Label>
                        <code className="block mt-1 p-2 rounded bg-muted text-xs font-mono">
                          x-api-key: YOUR_KEY
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
};

export default Settings;

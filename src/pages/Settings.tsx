import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Lock, Bell, Palette, Save, Loader2, Key, Copy, RefreshCw, Check, Bot, Server, HardDrive } from 'lucide-react';

const Settings = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [downloadNotifications, setDownloadNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
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
      
      setCurrentPassword('');
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
    // In a real app, these would be saved to the database
    localStorage.setItem('preferences', JSON.stringify({
      emailNotifications,
      downloadNotifications,
      weeklyReports,
      darkMode,
    }));
    toast.success('Preferences saved');
  };

  const generateApiKey = () => {
    if (!user) return;
    const secret = crypto.randomUUID().replace(/-/g, '');
    const key = `${user.id}:${secret}`;
    setApiKey(key);
    toast.success('API key generated! Save it securely - it won\'t be shown again.');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <Server className="h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Bell className="h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and avatar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} alt={fullName} />
                  <AvatarFallback className="text-lg">{getInitials(fullName)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input
                    id="avatar"
                    placeholder="https://example.com/avatar.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-[300px]"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
              </div>

              <Button onClick={handleUpdateProfile} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={loading || !newPassword} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">Current Session</p>
                  <p className="text-sm text-muted-foreground">
                    Logged in since {new Date().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Access</CardTitle>
              <CardDescription>
                Generate an API key to upload files via Telegram bots or other integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted border border-border">
                    <Label className="text-xs text-muted-foreground">Your API Key (save this securely!)</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={apiKey}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copyApiKey}>
                        {apiKeyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      ⚠️ This key will only be shown once. Store it securely!
                    </p>
                  </div>
                  <Button variant="outline" onClick={generateApiKey} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Generate New Key
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Generate an API key to upload files programmatically. This key can be used with our Telegram bot integration or any HTTP client.
                  </p>
                  <Button onClick={generateApiKey} className="gap-2">
                    <Key className="h-4 w-4" />
                    Generate API Key
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>How to use the upload API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Endpoint</Label>
                <code className="block p-3 rounded-lg bg-muted text-sm font-mono break-all">
                  POST https://tdkxjulqprvppliwtvwb.supabase.co/functions/v1/telegram-upload
                </code>
              </div>
              <div className="space-y-2">
                <Label>Headers</Label>
                <code className="block p-3 rounded-lg bg-muted text-sm font-mono">
                  x-api-key: YOUR_API_KEY<br/>
                  Content-Type: application/json
                </code>
              </div>
              <div className="space-y-2">
                <Label>Request Body</Label>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
{`{
  "file_name": "document.pdf",
  "file_data": "BASE64_ENCODED_FILE_DATA",
  "mime_type": "application/pdf",
  "folder_id": "optional-folder-uuid"
}`}
                </pre>
              </div>
              <div className="space-y-2">
                <Label>Response</Label>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
{`{
  "success": true,
  "file": {
    "id": "file-uuid",
    "name": "document.pdf",
    "size_bytes": 12345,
    "mime_type": "application/pdf"
  }
}`}
                </pre>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={() => window.location.href = '/dashboard/telegram-guide'} className="gap-2">
                  <Bot className="h-4 w-4" />
                  View Telegram Bot Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                VPS Storage Configuration
              </CardTitle>
              <CardDescription>
                Configure your own VPS/server to store files directly on your infrastructure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm text-primary">
                  To use VPS storage, you need to set up a file server on your VPS that accepts file uploads. 
                  Contact your system administrator to configure the following secrets in the backend:
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Required Backend Secrets</Label>
                  <div className="space-y-2 p-4 rounded-lg bg-muted">
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono">VPS_STORAGE_ENDPOINT</code>
                      <span className="text-xs text-muted-foreground">Your VPS file server URL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono">VPS_STORAGE_API_KEY</code>
                      <span className="text-xs text-muted-foreground">Authentication key for VPS</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>VPS Server Requirements</Label>
                  <div className="p-4 rounded-lg bg-muted text-sm space-y-2">
                    <p>Your VPS file server should implement these endpoints:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><code>POST /upload</code> - Accept file uploads</li>
                      <li><code>GET /files/:path</code> - Serve files</li>
                      <li><code>DELETE /delete</code> - Delete files</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sample VPS Server (Node.js)</CardTitle>
              <CardDescription>Example Express.js server for file storage</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-96">
{`const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const API_KEY = process.env.VPS_API_KEY;
const STORAGE_DIR = '/var/storage/files';

// Auth middleware
const auth = (req, res, next) => {
  const key = req.headers.authorization?.replace('Bearer ', '');
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

app.use(express.json({ limit: '100mb' }));

// Upload endpoint
app.post('/upload', auth, async (req, res) => {
  try {
    const { path: filePath, data, originalName } = req.body;
    const fullPath = path.join(STORAGE_DIR, filePath);
    
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
    
    res.json({ 
      success: true, 
      url: \`\${process.env.PUBLIC_URL}/files/\${filePath}\`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve files
app.get('/files/*', (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join(STORAGE_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(fullPath);
});

// Delete endpoint
app.delete('/delete', auth, (req, res) => {
  const { path: filePath } = req.body;
  const fullPath = path.join(STORAGE_DIR, filePath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  res.json({ success: true });
});

app.listen(3001, () => console.log('VPS Storage running on :3001'));`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Download Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when someone downloads your files</p>
                </div>
                <Switch
                  checked={downloadNotifications}
                  onCheckedChange={setDownloadNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly usage summaries via email</p>
                </div>
                <Switch
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the app looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Dark Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
              <Button onClick={handleSavePreferences} className="gap-2">
                <Save className="h-4 w-4" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, FolderOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const GuestAuth = () => {
  const [searchParams] = useSearchParams();
  const shareCode = searchParams.get('code');
  const navigate = useNavigate();
  const { guest, signIn, signUp, loading: authLoading } = useGuestAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>(shareCode ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [folderInfo, setFolderInfo] = useState<{ name: string; ownerName: string } | null>(null);

  useEffect(() => {
    if (guest && !authLoading) {
      navigate('/guest-portal');
    }
  }, [guest, authLoading, navigate]);

  useEffect(() => {
    const fetchFolderInfo = async () => {
      if (!shareCode) return;

      const { data } = await supabase
        .from('folder_shares')
        .select(`
          id,
          is_active,
          folder:folders(name),
          member_id
        `)
        .eq('share_code', shareCode)
        .eq('is_active', true)
        .maybeSingle();

      if (data && data.folder) {
        // Fetch member name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.member_id)
          .maybeSingle();

        setFolderInfo({
          name: (data.folder as any).name || 'Unknown Folder',
          ownerName: profileData?.full_name || 'A Member',
        });
      }
    };

    fetchFolderInfo();
  }, [shareCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!shareCode) {
          toast({
            title: 'Error',
            description: 'A folder share link is required to create an account',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName, shareCode);
        if (error) {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Success',
            description: 'Account created successfully!',
          });
          navigate('/guest-portal');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
        } else {
          navigate('/guest-portal');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Guest Portal</CardTitle>
              <CardDescription>
                {mode === 'signup' 
                  ? 'Create an account to access shared folders'
                  : 'Sign in to view your shared folders'}
              </CardDescription>
            </div>
          </CardHeader>

          {shareCode && folderInfo && (
            <div className="px-6 pb-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">You're joining:</p>
                <p className="font-semibold text-foreground">{folderInfo.name}</p>
                <p className="text-xs text-muted-foreground">Shared by {folderInfo.ownerName}</p>
              </div>
            </div>
          )}

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              {mode === 'signup' ? (
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    onClick={() => setMode('signin')}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Need to register with a folder link?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-primary hover:underline font-medium"
                    disabled={!shareCode}
                  >
                    Sign up
                  </button>
                  {!shareCode && (
                    <span className="block text-xs mt-1 text-muted-foreground/70">
                      (Requires a folder share link)
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Want full cloud storage access?{' '}
                <a href="/auth" className="text-primary hover:underline">
                  Create a member account
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default GuestAuth;

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, FolderOpen, Loader2, ArrowLeft, Cloud } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CelestialHorizon } from '@/components/visuals/CelestialHorizon';

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
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-[0_0_50px_rgba(20,184,166,0.3)]">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0b0b0d] flex items-center justify-center px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Background */}
      <CelestialHorizon />
      
      {/* Scanline overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back to home */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]"
          >
            <FolderOpen className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-white block"
            >
              Guest Portal
            </motion.span>
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xs text-white/40"
            >
              Powered by CloudVault
            </motion.span>
          </div>
        </div>

        {/* Glass Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="glass-card p-8 relative overflow-hidden"
        >
          {/* Subtle glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                {mode === 'signup' ? 'Create Guest Account' : 'Welcome Back'}
              </h1>
              <p className="text-white/50 text-sm">
                {mode === 'signup' 
                  ? 'Join to access shared folders'
                  : 'Sign in to view your shared folders'}
              </p>
            </div>

            {/* Folder Info Badge */}
            <AnimatePresence>
              {shareCode && folderInfo && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center"
                >
                  <p className="text-xs text-white/40 mb-1">You're joining:</p>
                  <p className="font-semibold text-white">{folderInfo.name}</p>
                  <p className="text-xs text-white/50">Shared by {folderInfo.ownerName}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <Label htmlFor="fullName" className="text-white/70 text-sm">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:bg-white/10 transition-all"
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:bg-white/10 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-12 focus:border-violet-500/50 focus:bg-white/10 transition-all"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-medium shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-300"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              {mode === 'signup' ? (
                <p className="text-white/40">
                  Already have an account?{' '}
                  <button
                    onClick={() => setMode('signin')}
                    className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-white/40">
                  Need to register with a folder link?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                    disabled={!shareCode}
                  >
                    Sign up
                  </button>
                  {!shareCode && (
                    <span className="block text-xs mt-1 text-white/30">
                      (Requires a folder share link)
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Member Account Link */}
            <div className="mt-4 pt-4 border-t border-white/5 text-center">
              <p className="text-xs text-white/30">
                Want full cloud storage access?{' '}
                <Link to="/auth" className="text-teal-400/70 hover:text-teal-400 transition-colors">
                  Create a member account
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default GuestAuth;

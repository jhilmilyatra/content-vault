import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useGuestUnreadCount } from '@/hooks/useGuestUnreadCount';
import {
  FolderOpen,
  Loader2,
  LogOut,
  Search,
  User,
  MessageCircle,
  Cloud,
  ArrowRight,
} from 'lucide-react';
import { CelestialHorizon } from '@/components/visuals/CelestialHorizon';

interface FolderAccess {
  id: string;
  folder_share_id: string;
  member_id: string;
  added_at: string;
  is_restricted: boolean;
  folder_share: {
    folder_id: string;
    is_active: boolean;
    folder: {
      name: string;
      description: string | null;
    };
  };
  member_name: string;
}

const GuestPortal = () => {
  const navigate = useNavigate();
  const { guest, loading: authLoading, signOut } = useGuestAuth();
  const { toast } = useToast();
  const { unreadCount } = useGuestUnreadCount(guest?.id);

  const [folders, setFolders] = useState<FolderAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !guest) {
      navigate('/guest-auth');
    }
  }, [guest, authLoading, navigate]);

  useEffect(() => {
    const fetchFolders = async () => {
      if (!guest) return;

      try {
        const { data, error } = await supabase.functions.invoke('guest-folders', {
          body: { guestId: guest.id },
        });

        if (error) throw error;

        if (data.error) {
          throw new Error(data.error);
        }

        setFolders(data.folders || []);
      } catch (error) {
        console.error('Error fetching folders:', error);
        toast({
          title: 'Error',
          description: 'Failed to load folders',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [guest, toast]);

  const handleSignOut = () => {
    signOut();
    navigate('/guest-auth');
  };

  const handleOpenFolder = (folderId: string) => {
    navigate(`/guest-portal/folder/${folderId}`);
  };

  const filteredFolders = folders.filter(f =>
    f.folder_share.folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b0b0d] flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mb-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.3)]">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          </motion.div>
          <div className="overflow-hidden h-6">
            <motion.span
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="block text-[10px] uppercase tracking-[0.4em] font-medium text-white/40"
            >
              Loading Portal
            </motion.span>
          </div>
        </div>
      </div>
    );
  }

  if (!guest) return null;

  return (
    <div className="min-h-screen bg-[#0b0b0d] relative overflow-hidden">
      {/* Background */}
      <CelestialHorizon />
      
      {/* Scanline overlay */}
      <div 
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />

      {/* Header */}
      <header className="relative z-20 border-b border-white/5 bg-[#0b0b0d]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-white text-base sm:text-lg tracking-tight">Guest Portal</h1>
              <p className="text-[10px] sm:text-xs text-white/40 hidden sm:block">Access your shared folders</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Help Desk Button */}
            <Button 
              variant="ghost"
              size="sm" 
              onClick={() => navigate('/guest-portal/help')}
              className="relative h-9 px-3 text-white/50 hover:text-white hover:bg-white/5 border border-white/10"
            >
              <MessageCircle className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline text-sm">Help Desk</span>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-lg shadow-rose-500/30"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </Button>
            
            {/* User info */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-white/70 truncate max-w-[120px]">
                {guest.full_name || guest.email}
              </span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut} 
              className="h-9 px-3 text-white/50 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline text-sm">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
            Welcome back, {guest.full_name?.split(' ')[0] || 'Guest'}
          </h2>
          <p className="text-white/50 text-sm sm:text-base">Browse and access folders shared with you</p>
        </motion.div>

        {/* Search */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-8"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-violet-500/50 text-base"
            />
          </div>
        </motion.div>

        {/* Folders Grid */}
        <AnimatePresence mode="wait">
          {filteredFolders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="glass-card p-12 text-center max-w-lg mx-auto"
            >
              <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-10 h-10 text-white/20" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No folders yet</h3>
              <p className="text-white/40 text-sm">
                {searchQuery
                  ? 'No folders match your search'
                  : "You haven't been invited to any folders yet. Ask a member to share a folder with you."}
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredFolders.map((folder, index) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  onClick={() => handleOpenFolder(folder.folder_share.folder_id)}
                  className="glass-card p-6 cursor-pointer group hover:border-violet-500/30 transition-all duration-300 relative overflow-hidden"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-purple-500/0 group-hover:from-violet-500/5 group-hover:to-purple-500/10 transition-all duration-500" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center group-hover:from-violet-500/30 group-hover:to-purple-500/30 transition-all duration-300 border border-violet-500/10">
                        <FolderOpen className="w-7 h-7 text-violet-400 group-hover:text-violet-300 transition-colors" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-violet-400 group-hover:translate-x-1 transition-all duration-300" />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-1 truncate group-hover:text-violet-100 transition-colors">
                      {folder.folder_share.folder.name}
                    </h3>
                    <p className="text-xs text-white/40 mb-3">
                      Shared by {folder.member_name}
                    </p>
                    
                    {folder.folder_share.folder.description && (
                      <p className="text-sm text-white/50 line-clamp-2">
                        {folder.folder_share.folder.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/30">
            <Cloud className="w-4 h-4" />
            <span className="text-xs">Powered by CloudVault</span>
          </div>
          <p className="text-xs text-white/20">© 2024 CloudVault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default GuestPortal;

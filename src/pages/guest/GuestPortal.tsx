import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  Loader2,
  LogOut,
  Search,
  User,
  HelpCircle,
} from 'lucide-react';

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
        // Use edge function to bypass RLS since guests aren't Supabase Auth users
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!guest) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Guest Portal</h1>
              <p className="text-xs text-muted-foreground">Access your shared folders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/guest-portal/help')}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help Desk
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{guest.full_name || guest.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Your Folders</h2>
          <p className="text-muted-foreground">Browse folders shared with you</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Folders Grid */}
        {filteredFolders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No folders yet</h3>
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? 'No folders match your search'
                  : 'You haven\'t been invited to any folders yet. Share a folder link to get started.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFolders.map((folder, index) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all group"
                  onClick={() => handleOpenFolder(folder.folder_share.folder_id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <FolderOpen className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {folder.folder_share.folder.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Shared by {folder.member_name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {folder.folder_share.folder.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {folder.folder_share.folder.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default GuestPortal;

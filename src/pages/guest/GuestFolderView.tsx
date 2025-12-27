import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getFileUrl, formatFileSize } from '@/lib/fileService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  Loader2,
  ArrowLeft,
  Search,
  Download,
  Eye,
  FileVideo,
  FileImage,
  FileText,
  FileArchive,
  FileAudio,
  File,
  Grid,
  List,
  ChevronRight,
  Home,
  RefreshCw,
} from 'lucide-react';
import { FilePreviewModal } from '@/components/files/FilePreviewModal';
import { type FileItem } from '@/lib/fileService';

interface FolderItem {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
}

const GuestFolderView = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { guest, loading: authLoading } = useGuestAuth();
  const { toast } = useToast();

  const [folder, setFolder] = useState<FolderItem | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [subfolders, setSubfolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !guest) {
      navigate('/guest-auth');
    }
  }, [guest, authLoading, navigate]);

  const fetchFolderContents = useCallback(async () => {
    if (!guest || !folderId) return;

    try {
      setLoading(true);
      
      const response = await supabase.functions.invoke('guest-folder-contents', {
        body: {
          guestId: guest.id,
          folderId,
          action: 'get-contents',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch folder');
      }

      const data = response.data;

      if (!data.folder) {
        toast({
          title: 'Access Denied',
          description: "You don't have permission to view this folder",
          variant: 'destructive',
        });
        navigate('/guest-portal');
        return;
      }

      setFolder(data.folder);
      setSubfolders(data.subfolders || []);
      setFiles(data.files || []);
      setBreadcrumbs(data.breadcrumbs || []);
      setRootFolderId(data.rootFolderId);
    } catch (error: any) {
      console.error('Error fetching folder:', error);
      
      if (error.message?.includes('Access denied') || error.message?.includes('403')) {
        toast({
          title: 'Access Denied',
          description: "You don't have permission to view this folder",
          variant: 'destructive',
        });
        navigate('/guest-portal');
        return;
      }

      toast({
        title: 'Error',
        description: 'Failed to load folder contents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [guest, folderId, navigate, toast]);

  useEffect(() => {
    fetchFolderContents();
  }, [fetchFolderContents]);

  // Realtime sync for files and folders
  useEffect(() => {
    if (!folderId || !guest) return;

    // Subscribe to file changes in this folder
    const filesChannel = supabase
      .channel(`guest-files-${folderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `folder_id=eq.${folderId}`,
        },
        () => {
          // Refetch folder contents on any file change
          fetchFolderContents();
        }
      )
      .subscribe();

    // Subscribe to subfolder changes
    const foldersChannel = supabase
      .channel(`guest-subfolders-${folderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'folders',
          filter: `parent_id=eq.${folderId}`,
        },
        () => {
          // Refetch folder contents on any folder change
          fetchFolderContents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filesChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [folderId, guest, fetchFolderContents]);

  const handleDownload = async (file: FileItem) => {
    try {
      const url = await getFileUrl(file.storage_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'Download started' });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = (file: FileItem) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const getFileIconComponent = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return FileImage;
    if (mimeType.startsWith('video/')) return FileVideo;
    if (mimeType.startsWith('audio/')) return FileAudio;
    if (mimeType === 'application/pdf') return FileText;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return FileArchive;
    return File;
  };

  const filteredSubfolders = subfolders.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!guest || !folder) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/guest-portal')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFolderContents}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm mb-6 overflow-x-auto">
          <button
            onClick={() => navigate('/guest-portal')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <Home className="w-4 h-4" />
            Folders
          </button>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              <button
                onClick={() => navigate(`/guest-portal/folder/${crumb.id}`)}
                className={`px-2 py-1 rounded hover:bg-muted transition-colors ${
                  index === breadcrumbs.length - 1
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Folder Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">{folder.name}</h2>
          {folder.description && (
            <p className="text-muted-foreground">{folder.description}</p>
          )}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Subfolders */}
        {filteredSubfolders.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Folders</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredSubfolders.map((subfolder, index) => (
                <motion.div
                  key={subfolder.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                    onClick={() => navigate(`/guest-portal/folder/${subfolder.id}`)}
                  >
                    <CardContent className="p-4 text-center">
                      <FolderOpen className="w-10 h-10 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-medium truncate">{subfolder.name}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {filteredFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Files</h3>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredFiles.map((file, index) => {
                  const IconComponent = getFileIconComponent(file.mime_type);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card className="hover:border-primary/50 hover:shadow-md transition-all group">
                        <CardContent className="p-4">
                          <div className="text-center mb-3">
                            <IconComponent className="w-10 h-10 text-muted-foreground mx-auto group-hover:text-primary transition-colors" />
                          </div>
                          <p className="text-sm font-medium truncate mb-1">{file.name}</p>
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatFileSize(file.size_bytes)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handlePreview(file)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleDownload(file)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {filteredFiles.map((file) => {
                      const IconComponent = getFileIconComponent(file.mime_type);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <IconComponent className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatFileSize(file.size_bytes)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(file)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(file)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {filteredSubfolders.length === 0 && filteredFiles.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'No results found' : 'This folder is empty'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'No files or folders here yet'}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewFile(null);
        }}
      />
    </div>
  );
};

export default GuestFolderView;

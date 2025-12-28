import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatFileSize } from '@/lib/fileService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
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
  FolderArchive,
} from 'lucide-react';
import { GuestFilePreviewModal } from '@/components/guest/GuestFilePreviewModal';
import { ZipProgressModal } from '@/components/guest/ZipProgressModal';

interface GuestFileItem {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}

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
  const isMobile = useIsMobile();

  const [folder, setFolder] = useState<FolderItem | null>(null);
  const [files, setFiles] = useState<GuestFileItem[]>([]);
  const [subfolders, setSubfolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [previewFile, setPreviewFile] = useState<GuestFileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [zipStatus, setZipStatus] = useState<'preparing' | 'processing' | 'complete' | 'error'>('preparing');
  const [zipError, setZipError] = useState<string | undefined>();

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
          fetchFolderContents();
        }
      )
      .subscribe();

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
          fetchFolderContents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filesChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [folderId, guest, fetchFolderContents]);

  const handleDownload = async (file: GuestFileItem) => {
    try {
      toast({ title: 'Preparing download...' });
      
      const response = await supabase.functions.invoke('guest-file-stream', {
        body: {
          guestId: guest?.id,
          storagePath: file.storage_path,
          action: 'download',
        },
      });

      if (response.error || !response.data?.url) {
        throw new Error('Failed to get download URL');
      }

      const a = document.createElement('a');
      a.href = response.data.url;
      a.download = file.original_name;
      a.target = '_blank';
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

  // Calculate total size of files for ZIP modal
  const totalFilesSize = files.reduce((sum, f) => sum + f.size_bytes, 0);

  const handleDownloadFolderAsZip = async () => {
    if (!guest || !folderId || files.length === 0) return;
    
    // Open modal and set initial state
    setZipModalOpen(true);
    setZipStatus('preparing');
    setZipError(undefined);
    setDownloadingZip(true);
    
    // Small delay to show preparing state
    await new Promise(resolve => setTimeout(resolve, 500));
    setZipStatus('processing');
    
    const maxRetries = 2;
    let lastError: string | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use fetch directly with proper blob handling to avoid data corruption
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
        
        const response = await fetch(`${supabaseUrl}/functions/v1/guest-folder-zip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ guestId: guest.id, folderId }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create ZIP');
        }

        // Get the response as a proper blob
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folder?.name || 'folder'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setZipStatus('complete');
        setDownloadingZip(false);
        return; // Success, exit the retry loop
      } catch (error: any) {
        console.error(`ZIP download attempt ${attempt + 1} failed:`, error);
        lastError = error.name === 'AbortError' 
          ? 'Request timed out. Please try again with fewer files.'
          : error.message || 'Failed to download folder as ZIP';
        
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // All retries failed
    setZipStatus('error');
    setZipError(lastError || 'Failed to download folder as ZIP. Please try again.');
    setDownloadingZip(false);
  };

  const handleZipModalClose = () => {
    setZipModalOpen(false);
    setZipStatus('preparing');
    setZipError(undefined);
  };

  const handlePreview = (file: GuestFileItem) => {
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/guest-portal')} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Back</span>
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadFolderAsZip}
              disabled={downloadingZip || files.length === 0}
              className="text-xs sm:text-sm"
            >
              {downloadingZip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderArchive className="w-4 h-4" />
              )}
              <span className="hidden sm:inline ml-2">Download ZIP</span>
            </Button>
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
                className={`p-1.5 sm:p-2 transition-colors ${
                  viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 sm:p-2 transition-colors ${
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
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-xs sm:text-sm mb-4 sm:mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => navigate('/guest-portal')}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors text-muted-foreground shrink-0"
          >
            <Home className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Folders</span>
          </button>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center shrink-0">
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mx-1" />
              <button
                onClick={() => navigate(`/guest-portal/folder/${crumb.id}`)}
                className={`px-2 py-1 rounded hover:bg-muted transition-colors truncate max-w-[100px] sm:max-w-none ${
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
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">{folder.name}</h2>
          {folder.description && (
            <p className="text-sm text-muted-foreground">{folder.description}</p>
          )}
        </div>

        {/* Search */}
        <div className="mb-4 sm:mb-6">
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
          <div className="mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Folders</h3>
            <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'}`}>
              {filteredSubfolders.map((subfolder, index) => (
                <motion.div
                  key={subfolder.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group touch-manipulation"
                    onClick={() => navigate(`/guest-portal/folder/${subfolder.id}`)}
                  >
                    <CardContent className="p-3 sm:p-4 text-center">
                      <FolderOpen className="w-8 h-8 sm:w-10 sm:h-10 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                      <p className="text-xs sm:text-sm font-medium truncate">{subfolder.name}</p>
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
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Files</h3>
            {viewMode === 'grid' ? (
              <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'}`}>
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
                        <CardContent className="p-3 sm:p-4">
                          <div className="text-center mb-2 sm:mb-3">
                            <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground mx-auto group-hover:text-primary transition-colors" />
                          </div>
                          <p className="text-xs sm:text-sm font-medium truncate mb-1">{file.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                            {formatFileSize(file.size_bytes)}
                          </p>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 touch-manipulation"
                              onClick={() => handlePreview(file)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-8 touch-manipulation"
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
                          className="flex items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <IconComponent className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size_bytes)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 touch-manipulation"
                              onClick={() => handlePreview(file)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 touch-manipulation"
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
            <CardContent className="py-8 sm:py-12 text-center">
              <FolderOpen className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'No results found' : 'This folder is empty'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'No files or folders here yet'}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* File Preview Modal */}
      <GuestFilePreviewModal
        file={previewFile}
        guestId={guest?.id || ''}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewFile(null);
        }}
      />

      {/* ZIP Progress Modal */}
      <ZipProgressModal
        open={zipModalOpen}
        onClose={handleZipModalClose}
        folderName={folder?.name || 'Folder'}
        totalFiles={files.length}
        totalSize={totalFilesSize}
        status={zipStatus}
        errorMessage={zipError}
      />
    </div>
  );
};

export default GuestFolderView;

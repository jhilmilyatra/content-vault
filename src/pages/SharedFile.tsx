import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Lock, FileIcon, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FileInfo {
  name: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
}

const SUPABASE_URL = "https://tdkxjulqprvppliwtvwb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Mo7TTw0d0vwjQUDGimwauQ_MiendM3Q";

const SharedFile = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const verifyLink = useCallback(async (pwd?: string) => {
    if (!shortCode) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      console.log('Calling verify-share-link with shortCode:', shortCode);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-share-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ shortCode, password: pwd })
      });

      const data = await response.json();
      console.log('Response from verify-share-link:', data);

      if (!response.ok) {
        setError(data.error || 'Failed to verify link');
        return;
      }

      if (data.requiresPassword) {
        setRequiresPassword(true);
        setFileName(data.fileName || 'Protected File');
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.success && data.file) {
        setFile(data.file);
        setRequiresPassword(false);
      }
    } catch (err: any) {
      console.error('Error verifying link:', err);
      setError(err.message || 'Failed to verify link');
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  }, [shortCode]);

  useEffect(() => {
    verifyLink();
  }, [verifyLink]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      verifyLink(password);
    }
  };

  const handleDownload = () => {
    if (file?.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
      toast.success('Download started!');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared file...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Link Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              This link may have expired, been removed, or reached its download limit.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>
              Enter the password to access "{fileName}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={verifying}
              />
              <Button type="submit" className="w-full" disabled={verifying || !password.trim()}>
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Unlock File'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (file) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <FileIcon className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="break-all">{file.name}</CardTitle>
            <CardDescription>
              {file.mimeType} • {formatFileSize(file.size)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Download File
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default SharedFile;

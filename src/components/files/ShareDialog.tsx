import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Link, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
}

const ShareDialog = ({ open, onOpenChange, fileId, fileName }: ShareDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Options
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiration, setUseExpiration] = useState(false);
  const [expirationDays, setExpirationDays] = useState('7');
  const [useMaxDownloads, setUseMaxDownloads] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState('10');

  const generateShortCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const hashPassword = async (pwd: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleCreateLink = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to create share links');
        return;
      }

      const shortCode = generateShortCode();
      let passwordHash: string | null = null;
      let expiresAt: string | null = null;
      let maxDl: number | null = null;

      if (usePassword && password.trim()) {
        passwordHash = await hashPassword(password);
      }

      if (useExpiration) {
        const days = parseInt(expirationDays);
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }

      if (useMaxDownloads) {
        maxDl = parseInt(maxDownloads);
      }

      const { error } = await supabase
        .from('shared_links')
        .insert({
          file_id: fileId,
          user_id: user.id,
          short_code: shortCode,
          password_hash: passwordHash,
          expires_at: expiresAt,
          max_downloads: maxDl
        });

      if (error) throw error;

      const url = `${window.location.origin}/share/${shortCode}`;
      setShareUrl(url);
      toast.success('Share link created!');
    } catch (error: any) {
      console.error('Error creating share link:', error);
      toast.error(error.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        } catch (e) {
          toast.error('Failed to copy link. Please copy manually.');
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setPassword('');
    setUsePassword(false);
    setUseExpiration(false);
    setUseMaxDownloads(false);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Share File
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for "{fileName}"
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-6">
            {/* Password Protection */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-password">Password Protection</Label>
                <p className="text-sm text-muted-foreground">Require password to download</p>
              </div>
              <Switch
                id="use-password"
                checked={usePassword}
                onCheckedChange={setUsePassword}
              />
            </div>
            {usePassword && (
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {/* Expiration */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-expiration">Link Expiration</Label>
                <p className="text-sm text-muted-foreground">Set when link expires</p>
              </div>
              <Switch
                id="use-expiration"
                checked={useExpiration}
                onCheckedChange={setUseExpiration}
              />
            </div>
            {useExpiration && (
              <Select value={expirationDays} onValueChange={setExpirationDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Max Downloads */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-max-downloads">Download Limit</Label>
                <p className="text-sm text-muted-foreground">Limit number of downloads</p>
              </div>
              <Switch
                id="use-max-downloads"
                checked={useMaxDownloads}
                onCheckedChange={setUseMaxDownloads}
              />
            </div>
            {useMaxDownloads && (
              <Select value={maxDownloads} onValueChange={setMaxDownloads}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 download</SelectItem>
                  <SelectItem value="5">5 downloads</SelectItem>
                  <SelectItem value="10">10 downloads</SelectItem>
                  <SelectItem value="25">25 downloads</SelectItem>
                  <SelectItem value="50">50 downloads</SelectItem>
                  <SelectItem value="100">100 downloads</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button onClick={handleCreateLink} className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Create Share Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {usePassword && <p>• Password protected</p>}
              {useExpiration && <p>• Expires in {expirationDays} day(s)</p>}
              {useMaxDownloads && <p>• Limited to {maxDownloads} download(s)</p>}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShareUrl(null)}>
              Create Another Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;

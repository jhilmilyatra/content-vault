import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Loader2, Link2, Users, Check, AlertCircle } from 'lucide-react';
import { useFeatureFlag } from '@/contexts/FeatureFlagsContext';

interface ShareFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: { id: string; name: string } | null;
  userId: string;
}

interface FolderShare {
  id: string;
  share_code: string;
  is_active: boolean;
  created_at: string;
}

const ShareFolderDialog = ({ open, onOpenChange, folder, userId }: ShareFolderDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingShare, setExistingShare] = useState<FolderShare | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Feature flags
  const publicSharesEnabled = useFeatureFlag('feature_public_shares');
  const guestRegistrationEnabled = useFeatureFlag('feature_guest_registration');

  useEffect(() => {
    const fetchExistingShare = async () => {
      if (!folder || !open) return;

      const { data } = await supabase
        .from('folder_shares')
        .select('*')
        .eq('folder_id', folder.id)
        .eq('member_id', userId)
        .maybeSingle();

      setExistingShare(data);
    };

    fetchExistingShare();
  }, [folder, userId, open]);

  const generateShareCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateShare = async () => {
    if (!folder) return;
    setLoading(true);

    try {
      const shareCode = generateShareCode();

      const { data, error } = await supabase
        .from('folder_shares')
        .insert({
          folder_id: folder.id,
          member_id: userId,
          share_code: shareCode,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setExistingShare(data);
      toast({ title: 'Folder share link created' });
    } catch (error) {
      console.error('Error creating share:', error);
      toast({
        title: 'Error',
        description: 'Failed to create share link',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!existingShare) return;

    try {
      const { error } = await supabase
        .from('folder_shares')
        .update({ is_active: isActive })
        .eq('id', existingShare.id);

      if (error) throw error;

      setExistingShare({ ...existingShare, is_active: isActive });
      toast({ title: isActive ? 'Link activated' : 'Link deactivated' });
    } catch (error) {
      console.error('Error updating share:', error);
      toast({
        title: 'Error',
        description: 'Failed to update share link',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async () => {
    if (!existingShare) return;

    const shareUrl = `${window.location.origin}/guest-auth?code=${existingShare.share_code}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link copied to clipboard' });
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
        toast({ title: 'Link copied to clipboard' });
        setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        toast({
          title: 'Error',
          description: 'Failed to copy link',
          variant: 'destructive',
        });
      }
      document.body.removeChild(textArea);
    }
  };

  if (!folder) return null;

  const shareUrl = existingShare
    ? `${window.location.origin}/guest-auth?code=${existingShare.share_code}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Share Folder for Guest Access
          </DialogTitle>
          <DialogDescription>
            Share "{folder.name}" with guests. They can create a guest account using this link
            to access the folder in read-only mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feature disabled warnings */}
          {(!publicSharesEnabled || !guestRegistrationEnabled) && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {!publicSharesEnabled && !guestRegistrationEnabled
                  ? 'Public sharing and guest registration are disabled by admin'
                  : !publicSharesEnabled
                  ? 'Public sharing is disabled by admin'
                  : 'Guest registration is disabled by admin'}
              </span>
            </div>
          )}

          {existingShare ? (
            <>
              <div className="flex items-center justify-between">
                <Label>Link Active</Label>
                <Switch
                  checked={existingShare.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={!publicSharesEnabled || !guestRegistrationEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>Guest Registration Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    disabled={!existingShare.is_active || !publicSharesEnabled || !guestRegistrationEnabled}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Guests click the link and create an account</li>
                  <li>They get read-only access to this folder</li>
                  <li>You can manage their access from your dashboard</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Create a shareable link that allows guests to register and access this folder.
              </p>
              <Button 
                onClick={handleCreateShare} 
                disabled={loading || !publicSharesEnabled || !guestRegistrationEnabled}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Guest Share Link
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareFolderDialog;

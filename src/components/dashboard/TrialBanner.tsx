import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Ban, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const TrialBanner = () => {
  const { subscription, daysRemaining, isTrialExpired, isSuspended, role } = useAuth();
  const navigate = useNavigate();

  // Owners don't see trial banners
  if (role === 'owner') return null;

  // Suspended user - full block
  if (isSuspended || isTrialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      >
        <div className="max-w-md mx-4 p-8 rounded-2xl bg-card border border-destructive/50 text-center shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center">
            <Ban className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Account Suspended</h2>
          <p className="text-muted-foreground mb-6">
            Your demo period has expired. Please upgrade to a premium plan or contact the owner to restore access.
          </p>
          
          <div className="space-y-3">
            <Button onClick={() => navigate('/dashboard/plans')} className="w-full" variant="hero">
              View Upgrade Plans
            </Button>
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Or contact support:</p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://t.me/kartoos0070"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Telegram
                </a>
                <a
                  href="https://instagram.com/theriturajprince"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Show warning banner for trial users
  if (subscription?.plan === 'free' && daysRemaining !== null) {
    const isUrgent = daysRemaining <= 2;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-4 p-4 rounded-xl border ${
          isUrgent 
            ? 'bg-destructive/10 border-destructive/30' 
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isUrgent ? 'bg-destructive/20' : 'bg-amber-500/20'
          }`}>
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${isUrgent ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
              {daysRemaining === 0 
                ? 'Your trial expires today!' 
                : daysRemaining === 1 
                  ? '1 day left in your trial'
                  : `${daysRemaining} days left in your trial`
              }
            </p>
            <p className="text-sm text-muted-foreground">
              Upgrade now to keep access to your files and get more storage.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/dashboard/plans')} 
            variant={isUrgent ? 'destructive' : 'default'}
            size="sm"
          >
            Upgrade Now
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
};

export default TrialBanner;

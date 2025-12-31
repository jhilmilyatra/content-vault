import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { useVpsConnection } from "@/hooks/useVpsConnection";
import { cn } from "@/lib/utils";

interface VpsStatusIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function VpsStatusIndicator({ compact = false, className }: VpsStatusIndicatorProps) {
  const { status, nextRetryIn, reconnectAttempts, forceReconnect, isOnline, isReconnecting } = useVpsConnection();

  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "text-green-400 bg-green-500/10 border-green-500/20";
      case "offline":
      case "reconnecting":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "checking":
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-white/40 bg-white/5 border-white/10";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "online":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "checking":
      case "reconnecting":
        return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
      case "offline":
        return <WifiOff className="w-3.5 h-3.5" />;
      default:
        return <Wifi className="w-3.5 h-3.5" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "online":
        return "Storage Online";
      case "checking":
        return "Checking...";
      case "reconnecting":
        return nextRetryIn ? `Retry in ${nextRetryIn}s` : "Reconnecting...";
      case "offline":
        return "Storage Offline";
      default:
        return "Unknown";
    }
  };

  if (compact) {
    return (
      <motion.button
        onClick={!isOnline ? forceReconnect : undefined}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors",
          getStatusColor(),
          !isOnline && "cursor-pointer hover:opacity-80",
          className
        )}
        title={isOnline ? "VPS Storage Online" : "Click to retry connection"}
      >
        {getStatusIcon()}
        <AnimatePresence mode="wait">
          <motion.span
            key={status + (nextRetryIn || "")}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="hidden sm:inline"
          >
            {getStatusText()}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm",
        getStatusColor(),
        className
      )}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <div>
          <p className="text-sm font-medium">{getStatusText()}</p>
          {isReconnecting && reconnectAttempts > 0 && (
            <p className="text-xs opacity-60">
              Attempt {reconnectAttempts + 1}
            </p>
          )}
        </div>
      </div>

      {!isOnline && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={forceReconnect}
          className="ml-auto px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
        >
          Retry Now
        </motion.button>
      )}
    </motion.div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";

interface VpsConnectionState {
  status: "online" | "offline" | "checking" | "reconnecting";
  lastChecked: Date | null;
  reconnectAttempts: number;
  nextRetryIn: number | null;
}

const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

// Exponential backoff config
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 60000; // 1 minute max
const BACKOFF_MULTIPLIER = 1.5;
const CHECK_INTERVAL = 30000; // Check every 30 seconds when online

export function useVpsConnection() {
  const [state, setState] = useState<VpsConnectionState>({
    status: "checking",
    lastChecked: null,
    reconnectAttempts: 0,
    nextRetryIn: null,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${VPS_ENDPOINT}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${VPS_API_KEY}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log("VPS health check failed:", error);
      return false;
    }
  }, []);

  const scheduleReconnect = useCallback((attempts: number) => {
    // Calculate delay with exponential backoff
    const delay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempts),
      MAX_RETRY_DELAY
    );

    setState(prev => ({
      ...prev,
      status: "reconnecting",
      reconnectAttempts: attempts,
      nextRetryIn: Math.ceil(delay / 1000),
    }));

    // Start countdown
    let remaining = Math.ceil(delay / 1000);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setState(prev => ({ ...prev, nextRetryIn: remaining }));
      }
    }, 1000);

    // Schedule the actual retry
    retryTimeoutRef.current = setTimeout(async () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      setState(prev => ({ ...prev, status: "checking", nextRetryIn: null }));

      const isOnline = await checkConnection();

      if (isOnline) {
        // Successfully reconnected!
        setState({
          status: "online",
          lastChecked: new Date(),
          reconnectAttempts: 0,
          nextRetryIn: null,
        });

        if (wasOfflineRef.current) {
          toast({
            title: "Storage Connected",
            description: "VPS storage server is back online",
          });
          wasOfflineRef.current = false;
        }

        // Resume normal checking interval
        checkIntervalRef.current = setInterval(async () => {
          const stillOnline = await checkConnection();
          if (!stillOnline) {
            clearAllTimers();
            wasOfflineRef.current = true;
            scheduleReconnect(0);
          } else {
            setState(prev => ({ ...prev, lastChecked: new Date() }));
          }
        }, CHECK_INTERVAL);
      } else {
        // Still offline, schedule next retry
        wasOfflineRef.current = true;
        scheduleReconnect(attempts + 1);
      }
    }, delay);
  }, [checkConnection, clearAllTimers]);

  const forceReconnect = useCallback(async () => {
    clearAllTimers();
    setState(prev => ({ ...prev, status: "checking", nextRetryIn: null }));

    const isOnline = await checkConnection();

    if (isOnline) {
      setState({
        status: "online",
        lastChecked: new Date(),
        reconnectAttempts: 0,
        nextRetryIn: null,
      });

      if (wasOfflineRef.current) {
        toast({
          title: "Storage Connected",
          description: "VPS storage server is back online",
        });
        wasOfflineRef.current = false;
      }

      // Resume normal checking
      checkIntervalRef.current = setInterval(async () => {
        const stillOnline = await checkConnection();
        if (!stillOnline) {
          clearAllTimers();
          wasOfflineRef.current = true;
          scheduleReconnect(0);
        } else {
          setState(prev => ({ ...prev, lastChecked: new Date() }));
        }
      }, CHECK_INTERVAL);
    } else {
      wasOfflineRef.current = true;
      scheduleReconnect(0);
    }
  }, [checkConnection, clearAllTimers, scheduleReconnect]);

  // Initial connection check
  useEffect(() => {
    const initialCheck = async () => {
      const isOnline = await checkConnection();

      if (isOnline) {
        setState({
          status: "online",
          lastChecked: new Date(),
          reconnectAttempts: 0,
          nextRetryIn: null,
        });

        // Start periodic checks
        checkIntervalRef.current = setInterval(async () => {
          const stillOnline = await checkConnection();
          if (!stillOnline) {
            clearAllTimers();
            wasOfflineRef.current = true;
            toast({
              title: "Storage Disconnected",
              description: "VPS storage server went offline. Attempting to reconnect...",
              variant: "destructive",
            });
            scheduleReconnect(0);
          } else {
            setState(prev => ({ ...prev, lastChecked: new Date() }));
          }
        }, CHECK_INTERVAL);
      } else {
        wasOfflineRef.current = true;
        scheduleReconnect(0);
      }
    };

    initialCheck();

    return () => {
      clearAllTimers();
    };
  }, [checkConnection, clearAllTimers, scheduleReconnect]);

  return {
    ...state,
    isOnline: state.status === "online",
    isReconnecting: state.status === "reconnecting" || state.status === "checking",
    forceReconnect,
  };
}

// Singleton instance for global access
let globalVpsState: VpsConnectionState | null = null;
let globalListeners: Set<(state: VpsConnectionState) => void> = new Set();

export function subscribeToVpsConnection(listener: (state: VpsConnectionState) => void) {
  globalListeners.add(listener);
  if (globalVpsState) {
    listener(globalVpsState);
  }
  return () => globalListeners.delete(listener);
}

export function updateGlobalVpsState(state: VpsConnectionState) {
  globalVpsState = state;
  globalListeners.forEach(listener => listener(state));
}

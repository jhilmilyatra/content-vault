import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Define all feature flags with their default values
export const FEATURE_FLAGS = {
  feature_guest_registration: true,
  feature_public_shares: true,
  feature_password_shares: true,
  feature_expiring_links: true,
  feature_download_limits: true,
  feature_video_streaming: true,
  feature_telegram_upload: true,
  feature_member_chat: true,
  feature_owner_chat: true,
  feature_analytics: true,
  maintenance_mode: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
type FeatureFlagsMap = { [K in FeatureFlagKey]: boolean };

interface FeatureFlagsState {
  flags: FeatureFlagsMap;
  maintenanceMessage: string;
  loading: boolean;
  error: string | null;
}

interface FeatureFlagsContextType extends FeatureFlagsState {
  isEnabled: (flag: FeatureFlagKey) => boolean;
  isMaintenanceMode: () => boolean;
  refetch: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeatureFlagsState>({
    flags: { ...FEATURE_FLAGS },
    maintenanceMessage: "",
    loading: true,
    error: null,
  });

  const fetchFlags = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("category", "features");

      if (error) throw error;

      const newFlags: FeatureFlagsMap = { ...FEATURE_FLAGS };
      let maintenanceMsg = "";

      (data || []).forEach((setting) => {
        if (setting.key === "maintenance_message") {
          maintenanceMsg = setting.value;
        } else if (setting.key in FEATURE_FLAGS) {
          const key = setting.key as FeatureFlagKey;
          newFlags[key] = setting.value === "true";
        }
      });

      setState({
        flags: newFlags,
        maintenanceMessage: maintenanceMsg,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error fetching feature flags:", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load feature flags",
      }));
    }
  }, []);

  useEffect(() => {
    fetchFlags();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("feature-flags-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "system_settings",
          filter: "category=eq.features",
        },
        () => {
          fetchFlags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (flag: FeatureFlagKey): boolean => {
      // During loading, return default values
      if (state.loading) {
        return FEATURE_FLAGS[flag];
      }
      return state.flags[flag] ?? FEATURE_FLAGS[flag];
    },
    [state.flags, state.loading]
  );

  const isMaintenanceMode = useCallback((): boolean => {
    return state.flags.maintenance_mode;
  }, [state.flags.maintenance_mode]);

  return (
    <FeatureFlagsContext.Provider
      value={{
        ...state,
        isEnabled,
        isMaintenanceMode,
        refetch: fetchFlags,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// Main hook to access feature flags
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

// Convenience hook for checking a single feature flag
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const { isEnabled, loading } = useFeatureFlags();
  // Return default during loading to prevent flicker
  if (loading) return FEATURE_FLAGS[flag];
  return isEnabled(flag);
}

// Convenience hook for maintenance mode
export function useMaintenanceMode() {
  const { isMaintenanceMode, maintenanceMessage, loading } = useFeatureFlags();
  return {
    isMaintenanceMode: loading ? false : isMaintenanceMode(),
    maintenanceMessage,
    loading,
  };
}

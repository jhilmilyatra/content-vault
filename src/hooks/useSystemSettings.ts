import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
}

export function useSystemSettings(category: string) {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("id, key, value, category, description")
        .eq("category", category)
        .order("key");

      if (error) throw error;

      setSettings(data || []);
      const initialEdits: Record<string, string> = {};
      (data || []).forEach((s) => {
        initialEdits[s.key] = s.value;
      });
      setEditedSettings(initialEdits);
    } catch (error) {
      console.error(`Error fetching ${category} settings:`, error);
      toast({
        title: "Error",
        description: `Failed to load ${category} settings`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [category, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleInputChange = (key: string, value: string) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (allowedRole: string, currentRole: string | null) => {
    if (currentRole !== "owner" && currentRole !== allowedRole) {
      toast({
        title: "Permission Denied",
        description: "Only owners can update settings",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const updates = settings
        .filter((s) => editedSettings[s.key] !== s.value)
        .map((s) => ({
          id: s.id,
          key: s.key,
          value: editedSettings[s.key],
          updated_at: new Date().toISOString(),
        }));

      if (updates.length === 0) {
        toast({ title: "No changes", description: "No settings were modified" });
        setSaving(false);
        return false;
      }

      for (const update of updates) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value: update.value, updated_at: update.updated_at })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: `Updated ${updates.length} setting(s)`,
      });

      await fetchSettings();
      return true;
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = settings.some((s) => editedSettings[s.key] !== s.value);

  const getSetting = (key: string) => editedSettings[key] || "";

  return {
    settings,
    editedSettings,
    loading,
    saving,
    hasChanges,
    fetchSettings,
    handleInputChange,
    handleSave,
    getSetting,
  };
}

// Hook to get a single setting value
export function useSettingValue(key: string) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchValue = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", key)
          .single();

        if (error) throw error;
        setValue(data?.value || null);
      } catch (error) {
        console.error(`Error fetching setting ${key}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchValue();
  }, [key]);

  return { value, loading };
}

// Hook to get feature flag boolean
export function useFeatureFlag(key: string, defaultValue = true) {
  const { value, loading } = useSettingValue(key);
  return {
    enabled: loading ? defaultValue : value === "true",
    loading,
  };
}

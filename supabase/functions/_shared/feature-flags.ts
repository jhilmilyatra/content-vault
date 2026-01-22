import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Feature flag keys that can be checked
 */
export type FeatureFlagKey =
  | 'feature_guest_registration'
  | 'feature_public_shares'
  | 'feature_password_shares'
  | 'feature_expiring_links'
  | 'feature_download_limits'
  | 'feature_video_streaming'
  | 'feature_telegram_upload'
  | 'feature_member_chat'
  | 'feature_owner_chat'
  | 'feature_analytics'
  | 'maintenance_mode';

/**
 * Default feature flag values (used when DB lookup fails or flag not found)
 */
const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
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
};

/**
 * Check if a feature flag is enabled
 * Uses service role client to bypass RLS
 */
export async function isFeatureEnabled(
  supabaseAdmin: SupabaseClient,
  flag: FeatureFlagKey
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', flag)
      .eq('category', 'features')
      .maybeSingle();

    if (error) {
      console.error(`Error checking feature flag ${flag}:`, error);
      return DEFAULT_FLAGS[flag];
    }

    if (!data) {
      return DEFAULT_FLAGS[flag];
    }

    return data.value === 'true';
  } catch (err) {
    console.error(`Exception checking feature flag ${flag}:`, err);
    return DEFAULT_FLAGS[flag];
  }
}

/**
 * Check if maintenance mode is active
 */
export async function isMaintenanceMode(supabaseAdmin: SupabaseClient): Promise<boolean> {
  return await isFeatureEnabled(supabaseAdmin, 'maintenance_mode');
}

/**
 * Get maintenance message
 */
export async function getMaintenanceMessage(supabaseAdmin: SupabaseClient): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_message')
      .eq('category', 'features')
      .maybeSingle();

    return data?.value || 'System is under maintenance. Please try again later.';
  } catch {
    return 'System is under maintenance. Please try again later.';
  }
}

/**
 * Create a standard CORS response for disabled features
 */
export function featureDisabledResponse(
  featureName: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: `${featureName} is currently disabled`,
      code: 'FEATURE_DISABLED'
    }),
    { 
      status: 503, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Create a maintenance mode response
 */
export function maintenanceResponse(
  message: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      error: message,
      code: 'MAINTENANCE_MODE'
    }),
    { 
      status: 503, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

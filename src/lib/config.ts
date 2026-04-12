/**
 * Centralised configuration for VPS, CDN, and Supabase credentials.
 *
 * VPS_CDN_URL and VPS_API_KEY are now loaded from the system_settings
 * table (category = 'vps') so they can be changed from the admin panel.
 * Hardcoded fallbacks are kept for offline / bootstrap scenarios.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Hardcoded fallbacks ─────────────────────────────────────
const FALLBACK_VPS_CDN_URL = 'https://cloudvaults.in';
const FALLBACK_VPS_API_KEY = 'kARTOOS@007';

// ─── In-memory cache ─────────────────────────────────────────
let _vpsCdnUrl: string | null = null;
let _vpsApiKey: string | null = null;
let _fetchPromise: Promise<void> | null = null;
let _lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function _loadVpsSettings(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'vps');

    if (error) throw error;

    for (const row of data || []) {
      if (row.key === 'vps_cdn_url') _vpsCdnUrl = row.value;
      if (row.key === 'vps_api_key') _vpsApiKey = row.value;
    }
    _lastFetch = Date.now();
  } catch (e) {
    console.warn('Failed to load VPS settings from DB, using fallbacks', e);
  }
}

function _ensureLoaded(): Promise<void> {
  if (_lastFetch && Date.now() - _lastFetch < CACHE_TTL) {
    return Promise.resolve();
  }
  if (!_fetchPromise) {
    _fetchPromise = _loadVpsSettings().finally(() => {
      _fetchPromise = null;
    });
  }
  return _fetchPromise;
}

/** Invalidate cache so the next call re-fetches from DB */
export function invalidateVpsConfig(): void {
  _lastFetch = 0;
  _vpsCdnUrl = null;
  _vpsApiKey = null;
}

// ─── Async getters (preferred) ───────────────────────────────
export async function getVpsCdnUrl(): Promise<string> {
  await _ensureLoaded();
  return _vpsCdnUrl || FALLBACK_VPS_CDN_URL;
}

export async function getVpsApiKey(): Promise<string> {
  await _ensureLoaded();
  return _vpsApiKey || FALLBACK_VPS_API_KEY;
}

// ─── Sync getters (for use where async is impossible) ────────
// These return cached value or fallback. Call `getVpsCdnUrl()` at
// app start to prime the cache.
export function getVpsCdnUrlSync(): string {
  return _vpsCdnUrl || FALLBACK_VPS_CDN_URL;
}

export function getVpsApiKeySync(): string {
  return _vpsApiKey || FALLBACK_VPS_API_KEY;
}

// ─── Legacy exports (sync, for components that can't await) ──
/** @deprecated Use getVpsCdnUrl() instead */
export const VPS_CDN_URL = FALLBACK_VPS_CDN_URL;
/** @deprecated Use getVpsApiKey() instead */
export const VPS_API_KEY = FALLBACK_VPS_API_KEY;
/** @deprecated Use getVpsCdnUrl() + '/api' instead */
export const VPS_API_URL = `${FALLBACK_VPS_CDN_URL}/api`;

// ─── Build VPS API URL dynamically ──────────────────────────
export function getVpsApiUrlSync(): string {
  return `${getVpsCdnUrlSync()}/api`;
}

// ─── Supabase (from Vite env) ────────────────────────────────
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

// ─── Helper: build edge-function URL ─────────────────────────
export function edgeFunctionUrl(fnName: string): string {
  return `${SUPABASE_URL}/functions/v1/${fnName}`;
}

// ─── Helper: build VPS processed-file URL ────────────────────
export function vpsProcessedUrl(storagePath: string, fileName: string): string {
  const cdnUrl = getVpsCdnUrlSync();
  const userId = storagePath.split('/')[0];
  const baseName = storagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  return `${cdnUrl}/api/files/${userId}/processed/${baseName}/${fileName}`;
}

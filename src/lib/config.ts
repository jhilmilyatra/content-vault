/**
 * Centralised configuration for VPS, CDN, and Supabase credentials.
 * 
 * Change values here to propagate everywhere in the frontend.
 */

// ─── VPS / CDN ───────────────────────────────────────────────
/** HTTPS CDN URL for the VPS (Cloudflare tunnel / domain) */
export const VPS_CDN_URL = 'https://cloudvaults.in';

/** Direct VPS API base (without trailing slash) */
export const VPS_API_URL = `${VPS_CDN_URL}/api`;

/** VPS API key used for direct uploads */
export const VPS_API_KEY = 'kARTOOS@007';

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
  const userId = storagePath.split('/')[0];
  const baseName = storagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  return `${VPS_CDN_URL}/api/files/${userId}/processed/${baseName}/${fileName}`;
}

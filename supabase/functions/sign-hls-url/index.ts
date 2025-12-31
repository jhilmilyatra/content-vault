/**
 * Sign HLS URL Edge Function
 * 
 * Generates HMAC-signed URLs for secure HLS streaming.
 * Also checks if HLS is available on the VPS.
 * 
 * Features:
 * - Time-limited URL expiry
 * - HMAC-SHA256 signature verification
 * - VPS HLS availability check
 * - Per-user access validation
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VPS Configuration
// VPS_ENDPOINT = internal HTTP for server-to-server (HLS status checks)
// VPS_CDN_URL = public HTTPS URL for client-facing URLs (Cloudflare proxied)
const VPS_ENDPOINT = Deno.env.get('VPS_ENDPOINT') || Deno.env.get('VPS_STORAGE_URL') || 'http://46.38.232.46:4000';
const VPS_CDN_URL = Deno.env.get('VPS_CDN_URL') || 'https://media.trycloudflare.com'; // MUST be HTTPS
const VPS_API_KEY = Deno.env.get('VPS_API_KEY') || Deno.env.get('VPS_STORAGE_API_KEY') || 'kARTOOS007';

// Signing secret - should match VPS server
const SIGNING_SECRET = Deno.env.get('HLS_SIGNING_SECRET') || VPS_API_KEY || 'default-signing-secret';

/**
 * Validate URL is HTTPS - critical for mixed content prevention
 */
function ensureHttps(url: string): string {
  if (url.startsWith("https://")) {
    return url;
  }
  console.error(`❌ SECURITY: Attempted to return HTTP URL to client: ${url}`);
  throw new Error("Insecure media URL blocked - HTTPS required");
}

/**
 * Generate HMAC-SHA256 signature
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// TTL: 12 hours for signed URLs - ensures long-form video playback never expires
const TWELVE_HOURS = 12 * 60 * 60; // 43200 seconds

/**
 * Sign a URL with expiry and HMAC (12-hour validity)
 */
async function signUrl(path: string, expiresInSec: number = TWELVE_HOURS): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const dataToSign = `${path}${exp}`;
  const sig = await generateSignature(dataToSign, SIGNING_SECRET);
  
  // Return HTTPS CDN URL for client
  const url = `${VPS_CDN_URL}${path}?exp=${exp}&sig=${sig}`;
  return ensureHttps(url);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (query params) and POST (JSON body)
    let storagePath: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      storagePath = url.searchParams.get('storagePath');
    } else {
      const body = await req.json().catch(() => ({}));
      storagePath = body.storagePath;
    }
    
    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: 'Missing storagePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Validate user owns the file (unless owner/admin)
      const userId = storagePath.split('/')[0];
      
      if (userId !== user.id) {
        const { data: userRole } = await supabase
          .rpc('get_user_role', { _user_id: user.id });
        
        if (userRole !== 'owner' && userRole !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the storage path to get HLS path
    // storagePath: userId/videoFile.mp4 -> HLS path: /hls/userId/videoFile/master.m3u8
    const pathParts = storagePath.split('/');
    const userId = pathParts[0];
    const fileName = pathParts.pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    
    // Check if HLS exists on VPS using HEAD first for quick check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // HEAD request first for quick existence check
      const headResponse = await fetch(
        `${VPS_ENDPOINT}/hls-status/${userId}/${fileName}`,
        {
          method: 'HEAD',
          headers: {
            'Authorization': `Bearer ${VPS_API_KEY}`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (!headResponse.ok) {
        // HLS not available
        return new Response(
          JSON.stringify({ 
            available: false, 
            message: 'HLS not available for this video' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // GET for full status
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 3000);
      
      const hlsCheckResponse = await fetch(
        `${VPS_ENDPOINT}/hls-status/${userId}/${fileName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${VPS_API_KEY}`,
          },
          signal: controller2.signal,
        }
      );
      clearTimeout(timeoutId2);
      
      if (!hlsCheckResponse.ok) {
        return new Response(
          JSON.stringify({ 
            available: false, 
            message: 'HLS not available for this video' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const hlsStatus = await hlsCheckResponse.json();
      
      if (!hlsStatus.hasHLS) {
        return new Response(
          JSON.stringify({ 
            available: false, 
            status: hlsStatus.status,
            progress: hlsStatus.progress,
            message: 'HLS transcoding in progress or not started' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // HLS is available - generate signed URL with 12-hour TTL
      const hlsPath = `/hls/${userId}/${baseName}/index.m3u8`;
      const signedUrl = await signUrl(hlsPath, TWELVE_HOURS);
      
      console.log(`HLS URL generated for: ${storagePath} (12h TTL)`);
      
      return new Response(
        JSON.stringify({
          available: true,
          signedUrl,
          qualities: hlsStatus.qualities || [],
          expiresAt: new Date((Math.floor(Date.now() / 1000) + TWELVE_HOURS) * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (vpsError) {
      console.error('VPS HLS check failed:', vpsError);
      return new Response(
        JSON.stringify({ 
          available: false, 
          message: 'VPS unreachable, HLS unavailable' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: unknown) {
    console.error('Sign HLS URL error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to sign URL', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

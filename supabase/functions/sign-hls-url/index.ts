/**
 * Sign HLS URL Edge Function
 * 
 * Generates HMAC-signed URLs for secure HLS streaming.
 * Also checks if HLS is available on the VPS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VPS Configuration
const VPS_ENDPOINT = Deno.env.get('VPS_ENDPOINT') || '';
const VPS_CDN_URL = Deno.env.get('VPS_CDN_URL') || '';
const VPS_API_KEY = Deno.env.get('VPS_API_KEY') || '';
const SIGNING_SECRET = Deno.env.get('HLS_SIGNING_SECRET') || VPS_API_KEY || 'default-signing-secret';

/**
 * Generate HMAC-SHA256 signature
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// TTL: 12 hours for signed URLs
const TWELVE_HOURS = 12 * 60 * 60;

/**
 * Sign a URL with expiry and HMAC
 */
async function signUrl(path: string, expiresInSec: number = TWELVE_HOURS): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const dataToSign = `${path}${exp}`;
  const sig = await generateSignature(dataToSign, SIGNING_SECRET);
  
  // Normalize URL - remove trailing slashes from CDN URL
  const normalizedCdnUrl = VPS_CDN_URL.replace(/\/+$/, '');
  return `${normalizedCdnUrl}${path}?exp=${exp}&sig=${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET and POST
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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate user owns the file
    const userId = storagePath.split('/')[0];
    
    if (userId !== user.id) {
      const { data: userRole } = await supabase.rpc('get_user_role', { _user_id: user.id });
      
      if (userRole !== 'owner' && userRole !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Check if VPS CDN is properly configured
    const hasCdnUrl = VPS_CDN_URL && VPS_CDN_URL.startsWith('https://');
    const hasVpsEndpoint = VPS_ENDPOINT && VPS_API_KEY;
    
    if (!hasCdnUrl || !hasVpsEndpoint) {
      return new Response(
        JSON.stringify({ available: false, message: 'HLS streaming not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse the storage path to get HLS path
    const pathParts = storagePath.split('/');
    const fileUserId = pathParts[0];
    const fileName = pathParts.pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    
    // Check if HLS exists on VPS
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const hlsCheckResponse = await fetch(
        `${VPS_ENDPOINT}/hls-status/${fileUserId}/${fileName}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${VPS_API_KEY}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (!hlsCheckResponse.ok) {
        return new Response(
          JSON.stringify({ available: false, message: 'HLS not available' }),
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
      
      // HLS is available - generate signed URL
      const hlsPath = `/hls/${fileUserId}/${baseName}/index.m3u8`;
      const signedUrl = await signUrl(hlsPath, TWELVE_HOURS);
      
      console.log(`HLS URL generated for: ${storagePath}`);
      
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
        JSON.stringify({ available: false, message: 'VPS unreachable' }),
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
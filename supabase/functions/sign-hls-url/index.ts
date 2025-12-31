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
const VPS_ENDPOINT = Deno.env.get('VPS_STORAGE_URL') || 'http://46.38.232.46:4000';
const VPS_API_KEY = Deno.env.get('VPS_STORAGE_API_KEY') || 'kARTOOS007';

// Signing secret - should match VPS server
const SIGNING_SECRET = Deno.env.get('HLS_SIGNING_SECRET') || VPS_API_KEY || 'default-signing-secret';

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

/**
 * Sign a URL with expiry and HMAC
 * Default TTL: 10 minutes (should be >= playlist TTL + max watch time buffer)
 */
async function signUrl(baseUrl: string, path: string, expiresInSec: number = 600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const dataToSign = `${path}${exp}`;
  const sig = await generateSignature(dataToSign, SIGNING_SECRET);
  
  return `${baseUrl}${path}?exp=${exp}&sig=${sig}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (query params) and POST (JSON body)
    let storagePath: string | null = null;
    let expiresIn: number | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      storagePath = url.searchParams.get('storagePath');
      expiresIn = parseInt(url.searchParams.get('expiresIn') || '3600');
    } else {
      const body = await req.json().catch(() => ({}));
      storagePath = body.storagePath;
      expiresIn = body.expiresIn || 3600;
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
    
    // Check if HLS exists on VPS
    try {
      const hlsCheckResponse = await fetch(
        `${VPS_ENDPOINT}/hls-status/${userId}/${fileName}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${VPS_API_KEY}`,
          },
        }
      );
      
      if (!hlsCheckResponse.ok) {
        // HLS not available
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
      
      // HLS is available - generate signed URL
      const hlsPath = `/hls/${userId}/${baseName}/master.m3u8`;
      const expirySeconds = expiresIn || 3600;
      const signedUrl = await signUrl(VPS_ENDPOINT, hlsPath, expirySeconds);
      
      console.log(`HLS URL generated for: ${storagePath}`);
      
      return new Response(
        JSON.stringify({
          available: true,
          signedUrl,
          qualities: hlsStatus.qualities || [],
          expiresAt: new Date((Math.floor(Date.now() / 1000) + expirySeconds) * 1000).toISOString(),
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

/**
 * Sign HLS URL Edge Function
 * 
 * Generates HMAC-signed URLs for secure HLS streaming.
 * Prevents hotlinking and unauthorized access to video content.
 * 
 * Features:
 * - Time-limited URL expiry
 * - HMAC-SHA256 signature verification
 * - Per-user access validation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Signing secret - should match VPS server
const SIGNING_SECRET = Deno.env.get('HLS_SIGNING_SECRET') || Deno.env.get('VPS_STORAGE_API_KEY') || 'default-signing-secret';

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
 */
async function signUrl(baseUrl: string, path: string, expiresInSec: number = 3600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const dataToSign = `${path}${exp}`;
  const sig = await generateSignature(dataToSign, SIGNING_SECRET);
  
  return `${baseUrl}${path}?exp=${exp}&sig=${sig}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { storagePath, vpsEndpoint, expiresIn } = await req.json();
    
    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: 'Missing storagePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Optional: Verify user has access to this file
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.warn('Auth error or no user:', authError?.message);
        // Continue without user validation for guest access
      } else {
        // Validate user owns the file or is owner/admin
        const userId = storagePath.split('/')[0];
        
        // Check if user is accessing their own files
        const { data: userRole } = await supabase
          .rpc('get_user_role', { _user_id: user.id });
        
        if (userId !== user.id && userRole !== 'owner' && userRole !== 'admin') {
          // Check if user has guest access
          const { data: guestAccess } = await supabase
            .from('guest_folder_access')
            .select('id')
            .eq('guest_id', user.id)
            .limit(1);
          
          if (!guestAccess || guestAccess.length === 0) {
            console.warn(`User ${user.id} denied access to ${storagePath}`);
            return new Response(
              JSON.stringify({ error: 'Access denied' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }
    
    // Parse the storage path to get HLS path
    // storagePath: userId/videoFile.mp4 -> HLS path: /hls/userId/videoFile/index.m3u8
    const pathParts = storagePath.split('/');
    const userId = pathParts[0];
    const fileName = pathParts.pop() || '';
    const baseName = fileName.replace(/\.[^.]+$/, '');
    
    const hlsPath = `/hls/${userId}/${baseName}/index.m3u8`;
    
    // Get VPS endpoint from request or environment
    const baseUrl = vpsEndpoint || Deno.env.get('VPS_STORAGE_URL') || 'https://storage.cloudvault.app';
    
    // Generate signed URL (default 1 hour expiry for playlists)
    const expirySeconds = expiresIn || 3600;
    const signedUrl = await signUrl(baseUrl, hlsPath, expirySeconds);
    
    // Also generate signed URLs for potential quality variants
    const signedUrls: Record<string, string> = {
      master: signedUrl,
    };
    
    // Generate variant URLs with longer expiry (segments are immutable)
    const qualities = ['360p', '480p', '720p', '1080p'];
    for (const q of qualities) {
      const variantPath = `/hls/${userId}/${baseName}/${q}/index.m3u8`;
      signedUrls[q] = await signUrl(baseUrl, variantPath, expirySeconds * 2); // 2x expiry for variants
    }
    
    console.log(`Signed HLS URL generated for: ${storagePath}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        signedUrl,
        signedUrls,
        expiresAt: new Date((Math.floor(Date.now() / 1000) + expirySeconds) * 1000).toISOString(),
        hlsPath,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Sign HLS URL error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to sign URL', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

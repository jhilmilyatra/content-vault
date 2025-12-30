import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Performance tracking
const SLOW_THRESHOLD_MS = 200;

interface VerifyRequest {
  shortCode: string;
  password?: string;
}

// Declare EdgeRuntime type
declare const EdgeRuntime: {
  waitUntil?: (promise: Promise<unknown>) => void;
} | undefined;

// Background task helper
function runInBackground(task: () => Promise<void>, taskName?: string): void {
  const wrappedTask = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`✗ Background [${taskName || 'task'}] failed:`, error);
    }
  };
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(wrappedTask());
  } else {
    wrappedTask();
  }
}

Deno.serve(async (req) => {
  const startTime = performance.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { shortCode, password }: VerifyRequest = await req.json();

    if (!shortCode) {
      return new Response(
        JSON.stringify({ error: 'Short code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying share link: ${shortCode}`);

    // ✅ OPTIMIZED: Single RPC call instead of JOIN query
    const { data: linkData, error: linkError } = await supabaseAdmin
      .rpc('verify_share_link_fast', { p_short_code: shortCode });

    const dbTime = performance.now() - startTime;

    if (linkError) {
      console.error('RPC error:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const link = linkData?.[0];

    if (!link || !link.is_valid) {
      const errorMsg = !link ? 'Link not found or expired' : 
                       link.expires_at && new Date(link.expires_at) < new Date() ? 'This link has expired' :
                       link.max_downloads && link.download_count >= link.max_downloads ? 'Download limit reached' :
                       'Link not found or expired';
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            // ✅ CACHE: Cache "not found" for short time to reduce DB load
            'Cache-Control': 'public, max-age=10, stale-while-revalidate=30'
          } 
        }
      );
    }

    // Check password if required
    if (link.requires_password) {
      if (!password) {
        return new Response(
          JSON.stringify({ requiresPassword: true, fileName: link.file_original_name }),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              // ✅ CACHE: Cache password requirement
              'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
            } 
          }
        );
      }

      // Verify password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex !== link.password_hash) {
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ✅ BACKGROUND: Move metrics update to background (non-blocking)
    runInBackground(async () => {
      await supabaseAdmin.rpc('increment_usage_metrics', {
        p_user_id: link.user_id,
        p_views: 1,
        p_downloads: 0,
        p_bandwidth: 0
      });
    }, 'increment_view_metrics');

    // Generate download URL
    const downloadUrl = `${supabaseUrl}/functions/v1/shared-download?code=${shortCode}`;

    const totalTime = performance.now() - startTime;
    if (totalTime > SLOW_THRESHOLD_MS) {
      console.warn(`⚠️ SLOW_EDGE [verify-share-link] ${Math.round(totalTime)}ms (db: ${Math.round(dbTime)}ms)`);
    }

    console.log(`Share link verified in ${Math.round(totalTime)}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          name: link.file_original_name,
          mimeType: link.file_mime_type,
          size: link.file_size,
          downloadUrl: downloadUrl
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          // ✅ CACHE: Cache successful validation for 30s
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
        } 
      }
    );

  } catch (error: unknown) {
    console.error('Error verifying share link:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

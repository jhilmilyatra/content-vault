import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Performance tracking
const SLOW_THRESHOLD_MS = 200;

// Primary VPS storage - hardcoded
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

// Declare EdgeRuntime type
declare const EdgeRuntime: {
  waitUntil?: (promise: Promise<unknown>) => void;
} | undefined;

// Background task helper - fire and forget
function runInBackground(task: () => Promise<void>, taskName?: string): void {
  const wrappedTask = async () => {
    try {
      await task();
      console.log(`✓ Background [${taskName}] completed`);
    } catch (error) {
      console.error(`✗ Background [${taskName}] failed:`, error);
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
  
  // Handle CORS preflight
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

    const url = new URL(req.url);
    const shortCode = url.searchParams.get('code');

    if (!shortCode) {
      return new Response(
        JSON.stringify({ error: 'Short code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Downloading shared file: ${shortCode}`);

    // ✅ OPTIMIZED: Use RPC for single query instead of JOIN
    const { data: linkData, error: linkError } = await supabaseAdmin
      .rpc('verify_share_link_fast', { p_short_code: shortCode });

    const dbTime = performance.now() - startTime;

    if (linkError || !linkData?.[0]) {
      console.log('Link not found or inactive:', linkError?.message);
      return new Response(
        JSON.stringify({ error: 'Link not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const link = linkData[0];

    // Validate link
    if (!link.is_valid) {
      const errorMsg = link.expires_at && new Date(link.expires_at) < new Date() 
        ? 'This link has expired' 
        : link.max_downloads && link.download_count >= link.max_downloads 
          ? 'Download limit reached'
          : 'Link is not valid';
      
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storagePath = link.file_storage_path;
    const fileName = link.file_original_name;
    const mimeType = link.file_mime_type;
    const fileSize = link.file_size;

    console.log(`Fetching file from VPS: ${storagePath}`);

    // Try to fetch from VPS first
    const vpsStartTime = performance.now();
    try {
      const vpsResponse = await fetch(`${VPS_ENDPOINT}/files/${storagePath}`, {
        headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
      });

      const vpsTime = performance.now() - vpsStartTime;

      if (vpsResponse.ok) {
        // ✅ BACKGROUND: Move metrics updates to background (non-blocking)
        runInBackground(async () => {
          // Update download count
          await supabaseAdmin
            .from('shared_links')
            .update({ download_count: link.download_count + 1 })
            .eq('id', link.link_id);

          // Update usage metrics with atomic RPC
          await supabaseAdmin.rpc('increment_usage_metrics', {
            p_user_id: link.user_id,
            p_views: 0,
            p_downloads: 1,
            p_bandwidth: fileSize || 0
          });
        }, 'update_download_metrics');

        const totalTime = performance.now() - startTime;
        if (totalTime > SLOW_THRESHOLD_MS) {
          console.warn(`⚠️ SLOW_EDGE [shared-download] ${Math.round(totalTime)}ms (db: ${Math.round(dbTime)}ms, vps: ${Math.round(vpsTime)}ms)`);
        }

        console.log(`Successfully served file from VPS: ${fileName} in ${Math.round(totalTime)}ms`);

        // ✅ Stream response directly instead of buffering with blob()
        return new Response(vpsResponse.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            'Content-Length': fileSize?.toString() || '',
            // ✅ CACHE: Allow CDN caching for public downloads
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
          },
        });
      }
    } catch (e) {
      console.error('VPS fetch failed:', e);
    }

    // Fallback to Supabase Storage
    console.log('Trying Supabase Storage fallback...');
    const { data, error } = await supabaseAdmin
      .storage
      .from('user-files')
      .download(storagePath);

    if (error) {
      console.error('Supabase Storage error:', error);
      return new Response(
        JSON.stringify({ error: 'File not found on any storage' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ BACKGROUND: Update metrics in background
    runInBackground(async () => {
      await supabaseAdmin
        .from('shared_links')
        .update({ download_count: link.download_count + 1 })
        .eq('id', link.link_id);

      await supabaseAdmin.rpc('increment_usage_metrics', {
        p_user_id: link.user_id,
        p_views: 0,
        p_downloads: 1,
        p_bandwidth: fileSize || 0
      });
    }, 'update_download_metrics_fallback');

    const totalTime = performance.now() - startTime;
    if (totalTime > SLOW_THRESHOLD_MS) {
      console.warn(`⚠️ SLOW_EDGE [shared-download-fallback] ${Math.round(totalTime)}ms`);
    }

    console.log(`Successfully served file from Supabase: ${fileName} in ${Math.round(totalTime)}ms`);

    return new Response(data, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': data.size?.toString() || '',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
      },
    });

  } catch (error: unknown) {
    console.error('Error downloading shared file:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

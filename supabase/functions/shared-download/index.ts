import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Primary VPS storage - hardcoded
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
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

    // Get the shared link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('shared_links')
      .select(`
        *,
        files (
          id,
          name,
          original_name,
          mime_type,
          size_bytes,
          storage_path
        )
      `)
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .single();

    if (linkError || !link) {
      console.log('Link not found or inactive:', linkError?.message);
      return new Response(
        JSON.stringify({ error: 'Link not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if file exists
    if (!link.files) {
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max downloads
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      return new Response(
        JSON.stringify({ error: 'Download limit reached' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: Password check should be done before calling this endpoint
    // This endpoint is for direct file download after verification

    const storagePath = link.files.storage_path;
    const fileName = link.files.original_name;
    const mimeType = link.files.mime_type;

    console.log(`Fetching file from VPS: ${storagePath}`);

    // Try to fetch from VPS
    try {
      const vpsResponse = await fetch(`${VPS_ENDPOINT}/files/${storagePath}`, {
        headers: { "Authorization": `Bearer ${VPS_API_KEY}` },
      });

      if (vpsResponse.ok) {
        const blob = await vpsResponse.blob();
        
        // Update download count in shared_links
        await supabaseAdmin
          .from('shared_links')
          .update({ download_count: link.download_count + 1 })
          .eq('id', link.id);

        // Update total_downloads and bandwidth in usage_metrics
        try {
          const { data: existingMetrics } = await supabaseAdmin
            .from('usage_metrics')
            .select('id, total_downloads, bandwidth_used_bytes')
            .eq('user_id', link.user_id)
            .single();

          if (existingMetrics) {
            await supabaseAdmin
              .from('usage_metrics')
              .update({ 
                total_downloads: (existingMetrics.total_downloads || 0) + 1,
                bandwidth_used_bytes: (Number(existingMetrics.bandwidth_used_bytes) || 0) + link.files.size_bytes,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingMetrics.id);
          } else {
            await supabaseAdmin
              .from('usage_metrics')
              .insert({
                user_id: link.user_id,
                total_downloads: 1,
                bandwidth_used_bytes: link.files.size_bytes,
                storage_used_bytes: 0,
                active_links_count: 1,
                total_views: 0
              });
          }
        } catch (metricsError) {
          console.error('Failed to update download metrics:', metricsError);
        }

        console.log(`Successfully served file from VPS: ${fileName}`);

        return new Response(blob, {
          headers: {
            ...corsHeaders,
            'Content-Type': mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
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

    // Update download count in shared_links
    await supabaseAdmin
      .from('shared_links')
      .update({ download_count: link.download_count + 1 })
      .eq('id', link.id);

    // Update total_downloads and bandwidth in usage_metrics
    try {
      const { data: existingMetrics } = await supabaseAdmin
        .from('usage_metrics')
        .select('id, total_downloads, bandwidth_used_bytes')
        .eq('user_id', link.user_id)
        .single();

      if (existingMetrics) {
        await supabaseAdmin
          .from('usage_metrics')
          .update({ 
            total_downloads: (existingMetrics.total_downloads || 0) + 1,
            bandwidth_used_bytes: (Number(existingMetrics.bandwidth_used_bytes) || 0) + link.files.size_bytes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMetrics.id);
      }
    } catch (metricsError) {
      console.error('Failed to update download metrics:', metricsError);
    }

    console.log(`Successfully served file from Supabase: ${fileName}`);

    return new Response(data, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
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

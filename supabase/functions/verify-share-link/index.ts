import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Primary VPS storage - hardcoded (same as vps-file function)
const VPS_ENDPOINT = "http://46.38.232.46:4000";
const VPS_API_KEY = "kARTOOS007";

interface VerifyRequest {
  shortCode: string;
  password?: string;
}

Deno.serve(async (req) => {
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

    const { shortCode, password }: VerifyRequest = await req.json();

    if (!shortCode) {
      return new Response(
        JSON.stringify({ error: 'Short code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying share link: ${shortCode}`);

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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if file exists
    if (!link.files) {
      console.log('File not found for link');
      return new Response(
        JSON.stringify({ error: 'File not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      console.log('Link has expired');
      return new Response(
        JSON.stringify({ error: 'This link has expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max downloads
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      console.log('Max downloads reached');
      return new Response(
        JSON.stringify({ error: 'Download limit reached' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check password if required
    if (link.password_hash) {
      if (!password) {
        return new Response(
          JSON.stringify({ requiresPassword: true, fileName: link.files?.original_name }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Simple password comparison
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex !== link.password_hash) {
        console.log('Invalid password');
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Increment view count in usage_metrics for the file owner
    try {
      const { data: existingMetrics } = await supabaseAdmin
        .from('usage_metrics')
        .select('id, total_views')
        .eq('user_id', link.user_id)
        .single();

      if (existingMetrics) {
        await supabaseAdmin
          .from('usage_metrics')
          .update({ 
            total_views: (existingMetrics.total_views || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMetrics.id);
      } else {
        // Create metrics record if it doesn't exist
        await supabaseAdmin
          .from('usage_metrics')
          .insert({
            user_id: link.user_id,
            total_views: 1,
            storage_used_bytes: 0,
            bandwidth_used_bytes: 0,
            active_links_count: 1,
            total_downloads: 0
          });
      }
    } catch (metricsError) {
      console.error('Failed to update view metrics:', metricsError);
      // Don't fail the request if metrics update fails
    }

    // Generate download URL using the shared-download edge function
    const downloadUrl = `${supabaseUrl}/functions/v1/shared-download?code=${shortCode}`;

    console.log('Share link verified successfully');

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          name: link.files.original_name,
          mimeType: link.files.mime_type,
          size: link.files.size_bytes,
          downloadUrl: downloadUrl
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

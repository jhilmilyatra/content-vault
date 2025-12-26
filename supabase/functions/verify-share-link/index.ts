import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  shortCode: string;
  password?: string;
}

serve(async (req) => {
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
      console.log('Link not found or inactive');
      return new Response(
        JSON.stringify({ error: 'Link not found or expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      console.log('Link has expired');
      return new Response(
        JSON.stringify({ error: 'This link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max downloads
    if (link.max_downloads && link.download_count >= link.max_downloads) {
      console.log('Max downloads reached');
      return new Response(
        JSON.stringify({ error: 'Download limit reached' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Simple password comparison (in production, use bcrypt)
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex !== link.password_hash) {
        console.log('Invalid password');
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate signed URL for the file
    const { data: signedUrl, error: signError } = await supabaseAdmin
      .storage
      .from('user-files')
      .createSignedUrl(link.files.storage_path, 3600); // 1 hour expiry

    if (signError) {
      console.error('Error creating signed URL:', signError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment download count
    await supabaseAdmin
      .from('shared_links')
      .update({ download_count: link.download_count + 1 })
      .eq('id', link.id);

    // Update bandwidth metrics
    await supabaseAdmin
      .from('usage_metrics')
      .update({ 
        bandwidth_used_bytes: link.files.size_bytes,
        total_downloads: 1
      })
      .eq('user_id', link.user_id);

    console.log('Share link verified successfully');

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          name: link.files.original_name,
          mimeType: link.files.mime_type,
          size: link.files.size_bytes,
          downloadUrl: signedUrl.signedUrl
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error verifying share link:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

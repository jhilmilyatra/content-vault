import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName?: string;
  role: string;
  plan: string;
  storageLimit: number;
  bandwidthLimit: number;
  maxLinks: number;
  validUntil: string | null;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    // Create client with user's auth to verify they're an owner
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User attempting to create user:', user.id);

    // Check if user is an owner
    const { data: roleData, error: roleError } = await supabaseUser
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'owner') {
      console.error('Role check failed:', roleError, roleData);
      return new Response(
        JSON.stringify({ error: 'Only owners can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateUserRequest = await req.json();
    const { email, password, fullName, role, plan, storageLimit, bandwidthLimit, maxLinks, validUntil } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating user:', email);

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
      }
    });

    if (createError) {
      console.error('Create user error:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = newUser.user.id;
    console.log('User created:', newUserId);

    // Update the role if not member
    if (role !== 'member') {
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: role })
        .eq('user_id', newUserId);

      if (roleUpdateError) {
        console.error('Role update error:', roleUpdateError);
      }
    }

    // Update subscription with custom values
    const subscriptionUpdates: Record<string, unknown> = {
      plan: plan,
      storage_limit_gb: storageLimit,
      bandwidth_limit_gb: bandwidthLimit,
      max_active_links: maxLinks,
    };

    if (validUntil) {
      subscriptionUpdates.valid_until = new Date(validUntil).toISOString();
    }

    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .update(subscriptionUpdates)
      .eq('user_id', newUserId);

    if (subError) {
      console.error('Subscription update error:', subError);
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'user_created',
      entity_type: 'user',
      entity_id: newUserId,
      target_user_id: newUserId,
      details: { 
        email, 
        role, 
        plan,
        storage_limit_gb: storageLimit,
        bandwidth_limit_gb: bandwidthLimit,
        max_active_links: maxLinks,
        valid_until: validUntil,
      }
    });

    console.log('User creation complete:', newUserId);

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

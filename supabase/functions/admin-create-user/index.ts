import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const createUserSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be under 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters'),
  fullName: z.string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be under 100 characters'),
  role: z.enum([
    'farmer_owner', 
    'farmhand', 
    'admin', 
    'government'
  ]).optional().default('farmer_owner'),
  invitationToken: z.string()
    .uuid('Invalid invitation token format')
    .optional()
});

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(id: string, max: number, window: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(id);
  if (rateLimitMap.size > 10000) {
    const cutoff = now - window;
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < cutoff) rateLimitMap.delete(key);
    }
  }
  if (!record || now > record.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + window });
    return { allowed: true };
  }
  if (record.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated and is super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is super admin
    const { data: isSuperAdmin, error: adminCheckError } = await supabaseAdmin
      .rpc('is_super_admin', { _user_id: user.id });

    if (adminCheckError || !isSuperAdmin) {
      console.error('Role check error:', adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Super admin verified:', user.email);

    // Rate limiting
    const identifier = user.id;
    const rateCheck = checkRateLimit(identifier, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter || 60) }
      });
    }

    // Parse and validate input with Zod
    const rawBody = await req.json();
    const parseResult = createUserSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: parseResult.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, fullName, role, invitationToken } = parseResult.data;

    // Only super admins can create government or admin users
    if ((role === 'government' || role === 'admin') && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only super admins can create government or admin users' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Create user with admin client
    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createUserError || !userData.user) throw createUserError || new Error('Failed to create user');

    // Update profile with full name
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', userData.user.id);

    if (profileError) console.error('Profile update error:', profileError);

    // Handle farmhand invitation if token provided
    if (role === 'farmhand' && invitationToken) {
      const { error: membershipError } = await supabaseAdmin
        .from('farm_memberships')
        .update({
          user_id: userData.user.id,
          invitation_status: 'accepted'
        })
        .eq('invitation_token', invitationToken);

      if (membershipError) throw membershipError;
    }

    // Add user role
    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: role || 'farmer_owner'
      });

    if (insertRoleError) throw insertRoleError;

    // Log user creation activity
    if (role) {
      const { error: logError } = await supabaseAdmin.rpc("log_user_activity", {
        _user_id: userData.user.id,
        _activity_type: "user_created",
        _activity_category: "security",
        _description: `User account created with ${role} role by admin`,
        _metadata: { role, created_by: user.id, is_super_admin: isSuperAdmin }
      });

      if (logError) console.error("Failed to log user creation:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, userId: userData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

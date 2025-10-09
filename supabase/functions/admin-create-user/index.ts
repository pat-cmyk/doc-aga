import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { email, password, invitationToken } = await req.json();

    // Create user with admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: email.split('@')[0] }
    });

    if (userError) throw userError;

    // Update farm membership
    const { error: membershipError } = await supabaseAdmin
      .from('farm_memberships')
      .update({
        user_id: userData.user.id,
        invitation_status: 'accepted'
      })
      .eq('invitation_token', invitationToken);

    if (membershipError) throw membershipError;

    // Add farmhand role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role: 'farmhand'
      });

    if (roleError) throw roleError;

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

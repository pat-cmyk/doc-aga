import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { fullName, businessName, businessDescription, contactPhone, contactEmail, businessAddress } = await req.json();

    console.log('Processing merchant signup for user:', user.id);

    // Call the database function
    const { data, error } = await supabaseClient.rpc('handle_merchant_signup', {
      _user_id: user.id,
      _full_name: fullName,
      _business_name: businessName,
      _business_description: businessDescription,
      _contact_phone: contactPhone,
      _contact_email: contactEmail,
      _business_address: businessAddress,
    });

    if (error) {
      console.error('Database function error:', error);
      throw error;
    }

    console.log('Merchant signup result:', data);

    if (!data.success) {
      throw new Error(data.error || 'Failed to complete merchant signup');
    }

    return new Response(
      JSON.stringify({ success: true, merchantId: data.merchant_id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in merchant-signup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteFarmRequest {
  farm_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify user is admin
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin');

    if (rolesError || !roles || roles.length === 0) {
      console.error('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { farm_id }: DeleteFarmRequest = await req.json();

    if (!farm_id) {
      return new Response(
        JSON.stringify({ error: 'farm_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify farm exists and is soft-deleted
    const { data: farm, error: farmError } = await supabaseClient
      .from('farms')
      .select('id, name, is_deleted')
      .eq('id', farm_id)
      .single();

    if (farmError || !farm) {
      console.error('Farm not found:', farmError);
      return new Response(
        JSON.stringify({ error: 'Farm not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!farm.is_deleted) {
      return new Response(
        JSON.stringify({ 
          error: 'Farm must be deactivated (soft-deleted) before permanent deletion',
          farm_name: farm.name 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check for associated animals
    const { count: animalCount, error: animalCountError } = await supabaseClient
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('farm_id', farm_id);

    if (animalCountError) {
      console.error('Error checking animals:', animalCountError);
      throw animalCountError;
    }

    if (animalCount && animalCount > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot delete farm with ${animalCount} animals. Please remove or transfer animals first.`,
          animal_count: animalCount 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the deletion attempt
    await supabaseClient
      .from('admin_actions')
      .insert({
        user_id: user.id,
        action: 'permanent_delete_farm',
        entity_type: 'farm',
        entity_id: farm_id,
        metadata: {
          farm_name: farm.name,
          timestamp: new Date().toISOString(),
        },
      });

    // Perform the permanent deletion (trigger will block if multiple rows somehow involved)
    const { error: deleteError } = await supabaseClient
      .from('farms')
      .delete()
      .eq('id', farm_id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    console.log(`Farm ${farm_id} (${farm.name}) permanently deleted by admin ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Farm "${farm.name}" permanently deleted`,
        farm_id: farm_id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in admin-permanent-delete-farm:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

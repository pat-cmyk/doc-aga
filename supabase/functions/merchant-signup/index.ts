import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const merchantSignupSchema = z.object({
  fullName: z.string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Full name must be under 100 characters'),
  businessName: z.string()
    .trim()
    .min(1, 'Business name is required')
    .max(150, 'Business name must be under 150 characters'),
  businessDescription: z.string()
    .trim()
    .max(1000, 'Description must be under 1000 characters')
    .optional()
    .nullable(),
  contactPhone: z.string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number format')
    .optional()
    .nullable(),
  contactEmail: z.string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be under 255 characters')
    .optional()
    .nullable(),
  businessAddress: z.string()
    .trim()
    .max(500, 'Address must be under 500 characters')
    .optional()
    .nullable()
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
    const parseResult = merchantSignupSchema.safeParse(rawBody);
    
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

    const { fullName, businessName, businessDescription, contactPhone, contactEmail, businessAddress } = parseResult.data;

    console.log('Processing merchant signup for user:', user.id);

    // Call the database function
    const { data, error } = await supabaseClient.rpc('handle_merchant_signup', {
      _user_id: user.id,
      _full_name: fullName,
      _business_name: businessName,
      _business_description: businessDescription || null,
      _contact_phone: contactPhone || null,
      _contact_email: contactEmail || null,
      _business_address: businessAddress || null,
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

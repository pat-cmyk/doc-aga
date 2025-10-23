import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_MAX = 20;
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

interface WeightEstimateData {
  birthDate: Date;
  gender: string;
  breed?: string;
  lifeStage?: string | null;
  livestockType?: string; // NEW
}

// Weight estimation logic - Cattle
const CATTLE_FEMALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Calf": { min: 40, max: 120 },
  "Heifer Calf": { min: 120, max: 200 },
  "Breeding Heifer": { min: 200, max: 380 },
  "Pregnant Heifer": { min: 350, max: 450 },
  "First-Calf Heifer": { min: 400, max: 500 },
  "Mature Cow": { min: 450, max: 650 },
};

const CATTLE_MALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Bull Calf": { min: 40, max: 180 },
  "Young Bull": { min: 180, max: 400 },
  "Mature Bull": { min: 400, max: 800 },
};

// Goat weight ranges
const GOAT_FEMALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Kid": { min: 5, max: 15 },
  "Young Doe": { min: 15, max: 30 },
  "Mature Doe": { min: 30, max: 60 },
};

const GOAT_MALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Kid": { min: 5, max: 15 },
  "Young Buck": { min: 15, max: 40 },
  "Mature Buck": { min: 40, max: 80 },
};

// Sheep weight ranges
const SHEEP_FEMALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Lamb": { min: 8, max: 20 },
  "Young Ewe": { min: 20, max: 40 },
  "Mature Ewe": { min: 40, max: 80 },
};

const SHEEP_MALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Lamb": { min: 8, max: 20 },
  "Young Ram": { min: 20, max: 50 },
  "Mature Ram": { min: 50, max: 120 },
};

// Carabao (Water Buffalo) weight ranges
const CARABAO_FEMALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Calf": { min: 20, max: 60 },
  "Young Female": { min: 60, max: 200 },
  "Mature Female": { min: 200, max: 500 },
};

const CARABAO_MALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Calf": { min: 20, max: 60 },
  "Young Bull": { min: 60, max: 250 },
  "Mature Bull": { min: 250, max: 700 },
};

function estimateWeightByAge(data: WeightEstimateData): number {
  const ageInMonths = Math.floor(
    (new Date().getTime() - data.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const isMale = data.gender?.toLowerCase() === "male";
  const livestockType = data.livestockType || 'cattle';
  
  let weightRange;
  
  // Select appropriate weight ranges based on livestock type
  let femaleRanges: Record<string, { min: number; max: number }>;
  let maleRanges: Record<string, { min: number; max: number }>;
  
  switch (livestockType) {
    case 'goat':
      femaleRanges = GOAT_FEMALE_WEIGHT_RANGES;
      maleRanges = GOAT_MALE_WEIGHT_RANGES;
      break;
    case 'sheep':
      femaleRanges = SHEEP_FEMALE_WEIGHT_RANGES;
      maleRanges = SHEEP_MALE_WEIGHT_RANGES;
      break;
    case 'carabao':
      femaleRanges = CARABAO_FEMALE_WEIGHT_RANGES;
      maleRanges = CARABAO_MALE_WEIGHT_RANGES;
      break;
    case 'cattle':
    default:
      femaleRanges = CATTLE_FEMALE_WEIGHT_RANGES;
      maleRanges = CATTLE_MALE_WEIGHT_RANGES;
      break;
  }
  
  // Age-based stage determination varies by livestock type
  if (isMale) {
    if (livestockType === 'goat' || livestockType === 'sheep') {
      if (ageInMonths < 6) weightRange = maleRanges[Object.keys(maleRanges)[0]]; // Kid/Lamb
      else if (ageInMonths < 12) weightRange = maleRanges[Object.keys(maleRanges)[1]]; // Young
      else weightRange = maleRanges[Object.keys(maleRanges)[2]]; // Mature
    } else { // cattle or carabao
      if (ageInMonths < 12) weightRange = maleRanges[Object.keys(maleRanges)[0]]; // Calf/Bull Calf
      else if (ageInMonths < 24) weightRange = maleRanges[Object.keys(maleRanges)[1]]; // Young Bull
      else weightRange = maleRanges[Object.keys(maleRanges)[2]]; // Mature Bull
    }
  } else {
    if (livestockType === 'goat' || livestockType === 'sheep') {
      if (ageInMonths < 6) weightRange = femaleRanges[Object.keys(femaleRanges)[0]]; // Kid/Lamb
      else if (ageInMonths < 12) weightRange = femaleRanges[Object.keys(femaleRanges)[1]]; // Young
      else weightRange = femaleRanges[Object.keys(femaleRanges)[2]]; // Mature
    } else if (livestockType === 'cattle') {
      if (ageInMonths < 8) weightRange = femaleRanges["Calf"];
      else if (ageInMonths < 12) weightRange = femaleRanges["Heifer Calf"];
      else if (ageInMonths < 24) weightRange = femaleRanges["Breeding Heifer"];
      else weightRange = femaleRanges["Mature Cow"];
    } else { // carabao
      if (ageInMonths < 12) weightRange = femaleRanges["Calf"];
      else if (ageInMonths < 24) weightRange = femaleRanges["Young Female"];
      else weightRange = femaleRanges["Mature Female"];
    }
  }
  
  if (!weightRange) return livestockType === 'goat' ? 30 : livestockType === 'sheep' ? 40 : livestockType === 'carabao' ? 250 : 300;
  
  return Math.round((weightRange.min + weightRange.max) / 2);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { farmId } = await req.json();

    if (!farmId) {
      throw new Error("farmId is required");
    }

    // Verify user is farm owner or manager
    const { data: hasAccess, error: accessError } = await supabaseClient
      .rpc('is_farm_owner_or_manager', { _user_id: user.id, _farm_id: farmId });

    if (accessError || !hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Farm owner or manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Get all animals without weight records
    const { data: animals, error: animalsError } = await supabaseClient
      .from("animals")
      .select("id, birth_date, gender, breed, livestock_type, current_weight_kg")
      .eq("farm_id", farmId)
      .eq("is_deleted", false);

    if (animalsError) throw animalsError;

    let populated = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const animal of animals || []) {
      // Skip if already has weight
      if (animal.current_weight_kg) continue;
      
      // Skip if no birth date
      if (!animal.birth_date) continue;

      // Estimate weight
      const estimatedWeight = estimateWeightByAge({
        birthDate: new Date(animal.birth_date),
        gender: animal.gender || "female",
        breed: animal.breed,
        livestockType: animal.livestock_type || "cattle",
      });

      // Insert weight record
      const { error: insertError } = await supabaseClient
        .from("weight_records")
        .insert({
          animal_id: animal.id,
          weight_kg: estimatedWeight,
          measurement_date: today,
          measurement_method: "estimated",
          notes: "Auto-populated estimate based on age and stage",
        });

      if (insertError) {
        console.error(`Error inserting weight for animal ${animal.id}:`, insertError);
        continue;
      }

      populated++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        populated,
        total: animals?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

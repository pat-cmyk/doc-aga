import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeightEstimateData {
  birthDate: Date;
  gender: string;
  breed?: string;
  lifeStage?: string | null;
}

// Weight estimation logic (matching frontend)
const FEMALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Calf": { min: 40, max: 120 },
  "Heifer Calf": { min: 120, max: 200 },
  "Breeding Heifer": { min: 200, max: 380 },
  "Pregnant Heifer": { min: 350, max: 450 },
  "First-Calf Heifer": { min: 400, max: 500 },
  "Mature Cow": { min: 450, max: 650 },
};

const MALE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  "Bull Calf": { min: 40, max: 180 },
  "Young Bull": { min: 180, max: 400 },
  "Mature Bull": { min: 400, max: 800 },
};

function estimateWeightByAge(data: WeightEstimateData): number {
  const ageInMonths = Math.floor(
    (new Date().getTime() - data.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  const isMale = data.gender?.toLowerCase() === "male";
  
  let weightRange;
  
  if (isMale) {
    if (ageInMonths < 12) weightRange = MALE_WEIGHT_RANGES["Bull Calf"];
    else if (ageInMonths < 24) weightRange = MALE_WEIGHT_RANGES["Young Bull"];
    else weightRange = MALE_WEIGHT_RANGES["Mature Bull"];
  } else {
    if (ageInMonths < 8) weightRange = FEMALE_WEIGHT_RANGES["Calf"];
    else if (ageInMonths < 12) weightRange = FEMALE_WEIGHT_RANGES["Heifer Calf"];
    else if (ageInMonths < 24) weightRange = FEMALE_WEIGHT_RANGES["Breeding Heifer"];
    else weightRange = FEMALE_WEIGHT_RANGES["Mature Cow"];
  }
  
  if (!weightRange) return 300; // Default fallback
  
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

    const { farmId } = await req.json();

    if (!farmId) {
      throw new Error("farmId is required");
    }

    // Get all animals without weight records
    const { data: animals, error: animalsError } = await supabaseClient
      .from("animals")
      .select("id, birth_date, gender, breed, current_weight_kg")
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

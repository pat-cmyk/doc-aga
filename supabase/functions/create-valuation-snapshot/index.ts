import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SnapshotResult {
  farmId: string;
  farmName: string;
  animalsProcessed: number;
  animalsValued: number;
  totalValue: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { farmId, snapshotType = "automated" } = body;

    console.log(`[create-valuation-snapshot] Starting snapshot creation. Type: ${snapshotType}, FarmId: ${farmId || 'all'}`);

    // Get farms to process
    let farmsQuery = supabase.from("farms").select("id, name").eq("deleted_at", null);
    
    if (farmId) {
      farmsQuery = farmsQuery.eq("id", farmId);
    }

    const { data: farms, error: farmsError } = await farmsQuery;

    if (farmsError) {
      console.error("[create-valuation-snapshot] Error fetching farms:", farmsError);
      throw farmsError;
    }

    if (!farms || farms.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No farms to process", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-valuation-snapshot] Processing ${farms.length} farms`);

    const results: SnapshotResult[] = [];
    const valuationDate = new Date().toISOString().split("T")[0];

    for (const farm of farms) {
      const farmResult: SnapshotResult = {
        farmId: farm.id,
        farmName: farm.name,
        animalsProcessed: 0,
        animalsValued: 0,
        totalValue: 0,
        errors: [],
      };

      try {
        // Get active animals with weight data
        const { data: animals, error: animalsError } = await supabase
          .from("animals")
          .select("id, livestock_type, current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg")
          .eq("farm_id", farm.id)
          .eq("is_deleted", false)
          .is("exit_date", null);

        if (animalsError) {
          farmResult.errors.push(`Failed to fetch animals: ${animalsError.message}`);
          results.push(farmResult);
          continue;
        }

        farmResult.animalsProcessed = animals?.length || 0;

        if (!animals || animals.length === 0) {
          console.log(`[create-valuation-snapshot] Farm ${farm.id}: No active animals`);
          results.push(farmResult);
          continue;
        }

        // Get primary livestock type (most common in the farm)
        const livestockCounts: Record<string, number> = {};
        animals.forEach((a) => {
          const type = a.livestock_type || "cattle";
          livestockCounts[type] = (livestockCounts[type] || 0) + 1;
        });
        const primaryLivestockType = Object.entries(livestockCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "cattle";

        // Get market price
        const { data: priceData } = await supabase.rpc("get_market_price", {
          p_livestock_type: primaryLivestockType,
          p_farm_id: farm.id,
        });

        const marketPrice = priceData?.[0]?.price || 300;

        // Create valuation records for each animal with weight
        const valuationRecords: Array<{
          farm_id: string;
          animal_id: string;
          valuation_date: string;
          weight_kg: number;
          market_price_per_kg: number;
          estimated_value: number;
          valuation_method: string;
          notes: string;
        }> = [];

        for (const animal of animals) {
          // Determine effective weight (priority: current > entry > birth)
          const effectiveWeight = animal.current_weight_kg 
            || (animal.entry_weight_unknown ? null : animal.entry_weight_kg)
            || animal.birth_weight_kg;

          if (effectiveWeight && effectiveWeight > 0) {
            const estimatedValue = effectiveWeight * marketPrice;
            
            valuationRecords.push({
              farm_id: farm.id,
              animal_id: animal.id,
              valuation_date: valuationDate,
              weight_kg: effectiveWeight,
              market_price_per_kg: marketPrice,
              estimated_value: estimatedValue,
              valuation_method: "market_weight",
              notes: `${snapshotType} snapshot`,
            });

            farmResult.animalsValued++;
            farmResult.totalValue += estimatedValue;
          }
        }

        // Insert valuations in batch
        if (valuationRecords.length > 0) {
          const { error: insertError } = await supabase
            .from("biological_asset_valuations")
            .upsert(valuationRecords, {
              onConflict: "farm_id,animal_id,valuation_date",
              ignoreDuplicates: false,
            });

          if (insertError) {
            farmResult.errors.push(`Failed to insert valuations: ${insertError.message}`);
          } else {
            console.log(
              `[create-valuation-snapshot] Farm ${farm.id}: Created ${valuationRecords.length} valuations, total value: ₱${farmResult.totalValue.toLocaleString()}`
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        farmResult.errors.push(`Unexpected error: ${message}`);
        console.error(`[create-valuation-snapshot] Farm ${farm.id} error:`, err);
      }

      results.push(farmResult);
    }

    // Summary
    const totalFarms = results.length;
    const successfulFarms = results.filter((r) => r.errors.length === 0).length;
    const totalAnimalsValued = results.reduce((sum, r) => sum + r.animalsValued, 0);
    const grandTotalValue = results.reduce((sum, r) => sum + r.totalValue, 0);

    console.log(
      `[create-valuation-snapshot] Complete. Farms: ${successfulFarms}/${totalFarms}, Animals valued: ${totalAnimalsValued}, Total value: ₱${grandTotalValue.toLocaleString()}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        snapshotDate: valuationDate,
        snapshotType,
        summary: {
          totalFarms,
          successfulFarms,
          totalAnimalsValued,
          grandTotalValue,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[create-valuation-snapshot] Fatal error:", error);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

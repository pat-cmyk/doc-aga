import { supabase } from "@/integrations/supabase/client";
import { getCachedFeedInventory, getCachedDashboardStats } from "@/lib/dataCache";

/**
 * Data integrity check results
 */
export interface IntegrityCheckResult {
  passed: boolean;
  checkName: string;
  details: string;
  discrepancies: Array<{
    id: string;
    field: string;
    expected: string | number;
    actual: string | number;
  }>;
}

interface MilkRecord {
  id: string;
  liters: number;
  sale_amount: number | null;
}

interface RevenueRecord {
  id: string;
  linked_milk_log_id: string | null;
  amount: number | null;
}

interface AnimalRecord {
  id: string;
  ear_tag: string | null;
  current_weight_kg: number | null;
}

interface WeightRecord {
  weight_kg: number;
  measurement_date: string;
}

interface ValuationRecord {
  id: string;
  animal_id: string;
  valuation_date: string;
  weight_kg: number | null;
  market_price_per_kg: number | null;
  estimated_value: number | null;
}

interface ConsistencyCheckRow {
  check_name: string;
  is_consistent: boolean;
  expected_value: string | number | null;
  actual_value: string | number | null;
}

/**
 * Check that all milk sales have corresponding revenue entries
 */
export async function checkMilkRevenueSync(farmId: string): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "milk_revenue_sync",
    details: "",
    discrepancies: [],
  };

  try {
    // Get animals for this farm first
    const { data: animals } = await supabase
      .from("animals")
      .select("id")
      .eq("farm_id", farmId);

    if (!animals || animals.length === 0) {
      result.details = "No animals found for this farm";
      return result;
    }

    const animalIds = animals.map((a) => a.id);

    // Get all sold milk records for farm's animals
    const { data: soldMilkRaw, error: milkError } = await supabase
      .from("milking_records")
      .select("id, liters, sale_amount")
      .in("animal_id", animalIds)
      .eq("is_sold", true)
      .not("sale_amount", "is", null);

    if (milkError) throw milkError;

    const soldMilk = (soldMilkRaw || []) as MilkRecord[];

    // Get all milk revenues for this farm
    const revenueQuery = supabase
      .from("farm_revenues")
      .select("id, linked_milk_log_id, amount")
      .eq("farm_id", farmId);
    
    const { data: revenuesRaw, error: revenueError } = await revenueQuery;

    if (revenueError) throw revenueError;

    const revenues = (revenuesRaw || []) as RevenueRecord[];

    const revenuesByMilkId = new Map(
      revenues
        .filter((r) => r.linked_milk_log_id)
        .map((r) => [r.linked_milk_log_id, r])
    );

    // Check each sold milk record has a matching revenue
    for (const milk of soldMilk) {
      const revenue = revenuesByMilkId.get(milk.id);
      
      if (!revenue) {
        result.passed = false;
        result.discrepancies.push({
          id: milk.id,
          field: "missing_revenue",
          expected: `Revenue entry for ₱${milk.sale_amount}`,
          actual: "No linked revenue found",
        });
      } else if (revenue.amount !== milk.sale_amount) {
        result.passed = false;
        result.discrepancies.push({
          id: milk.id,
          field: "amount_mismatch",
          expected: milk.sale_amount || 0,
          actual: revenue.amount || 0,
        });
      }
    }

    const orphanedCount = result.discrepancies.filter((d) => d.field === "missing_revenue").length;
    const mismatchCount = result.discrepancies.filter((d) => d.field === "amount_mismatch").length;

    result.details = result.passed
      ? `All ${soldMilk.length} milk sales have matching revenues`
      : `Found ${orphanedCount} orphaned sales, ${mismatchCount} amount mismatches`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Check that animal current weights match latest weight records
 */
export async function checkWeightSync(farmId: string): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "weight_sync",
    details: "",
    discrepancies: [],
  };

  try {
    // Get animals with current weight
    const { data: animalsRaw, error: animalsError } = await supabase
      .from("animals")
      .select("id, ear_tag, current_weight_kg")
      .eq("farm_id", farmId)
      .eq("is_deleted", false)
      .not("current_weight_kg", "is", null);

    if (animalsError) throw animalsError;

    const animals = (animalsRaw || []) as AnimalRecord[];

    // For each animal, check latest weight record
    for (const animal of animals) {
      const { data: latestWeightRaw, error: weightError } = await supabase
        .from("weight_records")
        .select("weight_kg, measurement_date")
        .eq("animal_id", animal.id)
        .order("measurement_date", { ascending: false })
        .limit(1)
        .single();

      if (weightError && weightError.code !== "PGRST116") {
        // PGRST116 = no rows found, which is OK
        throw weightError;
      }

      const latestWeight = latestWeightRaw as WeightRecord | null;

      if (latestWeight && latestWeight.weight_kg !== animal.current_weight_kg) {
        result.passed = false;
        result.discrepancies.push({
          id: animal.id,
          field: `animal_${animal.ear_tag || animal.id.slice(0, 8)}`,
          expected: latestWeight.weight_kg,
          actual: animal.current_weight_kg || 0,
        });
      }
    }

    result.details = result.passed
      ? `All ${animals.length} animal weights are in sync`
      : `Found ${result.discrepancies.length} out-of-sync weights`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Check daily stats consistency using the RPC function
 */
export async function checkStatsConsistency(
  farmId: string,
  date: string
): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "stats_consistency",
    details: "",
    discrepancies: [],
  };

  try {
    const { data, error } = await supabase.rpc("check_data_consistency", {
      p_farm_id: farmId,
      p_date: date,
    });

    if (error) throw error;

    const checks = (data || []) as ConsistencyCheckRow[];

    for (const check of checks) {
      if (!check.is_consistent) {
        result.passed = false;
        result.discrepancies.push({
          id: check.check_name || "unknown",
          field: check.check_name || "field",
          expected: check.expected_value ?? "N/A",
          actual: check.actual_value ?? "N/A",
        });
      }
    }

    result.details = result.passed
      ? `All consistency checks passed for ${date}`
      : `Found ${result.discrepancies.length} inconsistencies`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Check valuation data quality
 */
export async function checkValuationConsistency(farmId: string): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "valuation_consistency",
    details: "",
    discrepancies: [],
  };

  try {
    // Get current month valuations
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const { data: valuationsRaw, error: valError } = await supabase
      .from("biological_asset_valuations")
      .select("id, animal_id, valuation_date, weight_kg, market_price_per_kg, estimated_value")
      .eq("farm_id", farmId)
      .gte("valuation_date", `${currentMonth}-01`);

    if (valError) throw valError;

    const valuations = (valuationsRaw || []) as ValuationRecord[];

    // Check for calculation errors
    for (const v of valuations) {
      const expectedValue = (v.weight_kg || 0) * (v.market_price_per_kg || 0);
      const actualValue = v.estimated_value || 0;
      
      // Allow 1 peso tolerance for rounding
      if (Math.abs(expectedValue - actualValue) > 1) {
        result.passed = false;
        result.discrepancies.push({
          id: v.id,
          field: `valuation_${v.animal_id?.slice(0, 8)}`,
          expected: expectedValue,
          actual: actualValue,
        });
      }
    }

    result.details = result.passed
      ? `All ${valuations.length} valuations are correctly calculated`
      : `Found ${result.discrepancies.length} calculation errors`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Check feed inventory cache-server consistency
 */
export async function checkFeedInventorySync(farmId: string): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "feed_inventory_sync",
    details: "",
    discrepancies: [],
  };

  try {
    // Get cached feed inventory
    const cached = await getCachedFeedInventory(farmId);
    
    // Get server feed inventory
    const { data: serverItems, error } = await supabase
      .from("feed_inventory")
      .select("*")
      .eq("farm_id", farmId);

    if (error) throw error;

    const cacheItems = cached?.items || [];
    const serverCount = serverItems?.length || 0;
    const cacheCount = cacheItems.length;

    // Check item count mismatch
    if (cacheCount !== serverCount) {
      result.passed = false;
      result.discrepancies.push({
        id: "item_count",
        field: "count",
        expected: serverCount,
        actual: cacheCount,
      });
    }

    // Compare totals by category
    if (cached?.summary && serverItems) {
      const serverConcentrate = serverItems
        .filter((i: any) => i.category === "concentrates")
        .reduce((sum: number, i: any) => sum + (i.quantity_kg || 0), 0);
      const serverRoughage = serverItems
        .filter((i: any) => i.category === "roughage" || !i.category)
        .reduce((sum: number, i: any) => sum + (i.quantity_kg || 0), 0);

      if (Math.abs(cached.summary.concentrateKg - serverConcentrate) > 0.1) {
        result.passed = false;
        result.discrepancies.push({
          id: "concentrate_kg",
          field: "concentrateKg",
          expected: serverConcentrate,
          actual: cached.summary.concentrateKg,
        });
      }

      if (Math.abs(cached.summary.roughageKg - serverRoughage) > 0.1) {
        result.passed = false;
        result.discrepancies.push({
          id: "roughage_kg",
          field: "roughageKg",
          expected: serverRoughage,
          actual: cached.summary.roughageKg,
        });
      }
    }

    result.details = result.passed
      ? `Feed inventory in sync: ${serverCount} items`
      : `Found ${result.discrepancies.length} discrepancies`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Check dashboard feedStockBreakdown consistency
 */
export async function checkFeedStockBreakdownSync(farmId: string): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    passed: true,
    checkName: "feed_stock_breakdown_sync",
    details: "",
    discrepancies: [],
  };

  try {
    // Get cached dashboard stats
    const cached = await getCachedDashboardStats(farmId);

    if (!cached) {
      result.details = "No dashboard cache found";
      return result;
    }

    // Check if cache version is current
    const EXPECTED_VERSION = 3;
    if ((cached.cacheVersion || 0) < EXPECTED_VERSION) {
      result.passed = false;
      result.discrepancies.push({
        id: "cache_version",
        field: "cacheVersion",
        expected: EXPECTED_VERSION,
        actual: cached.cacheVersion || 0,
      });
    }

    // Verify feedStockBreakdown exists if we have animals
    if (cached.stats.totalAnimals > 0 && !cached.stats.feedStockBreakdown) {
      result.passed = false;
      result.discrepancies.push({
        id: "missing_breakdown",
        field: "feedStockBreakdown",
        expected: "object",
        actual: "undefined",
      });
    }

    result.details = result.passed
      ? "Dashboard feed stock breakdown in sync"
      : `Found ${result.discrepancies.length} discrepancies`;

  } catch (error) {
    result.passed = false;
    result.details = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }

  return result;
}

/**
 * Run all integrity checks for a farm
 */
export async function runAllIntegrityChecks(
  farmId: string,
  date?: string
): Promise<IntegrityCheckResult[]> {
  const checkDate = date || new Date().toISOString().split("T")[0];
  
  const results = await Promise.all([
    checkMilkRevenueSync(farmId),
    checkWeightSync(farmId),
    checkStatsConsistency(farmId, checkDate),
    checkValuationConsistency(farmId),
    checkFeedInventorySync(farmId),
    checkFeedStockBreakdownSync(farmId),
  ]);

  return results;
}

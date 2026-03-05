import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, differenceInMonths } from "date-fns";
import { formatPHP } from "./currency";

export interface FarmProfile {
  farmName: string;
  ownerName: string;
  gpsLat: number | null;
  gpsLng: number | null;
  region: string | null;
  province: string | null;
  municipality: string | null;
  livestockType: string;
  totalActiveAnimals: number;
  farmCreatedAt: string;
  // Bank-required fields
  biosecurityLevel: string | null;
  waterSource: string | null;
  distanceToMarketKm: number | null;
  pcicEnrolled: boolean;
}

export interface HerdComposition {
  category: string;
  count: number;
  acquisitionType: string;
  estimatedValue: number;
}

export interface HerdSummary {
  composition: HerdComposition[];
  totalAnimals: number;
  totalValue: number;
  averageWeight: number | null;
  marketPricePerKg: number;
}

export interface ProductionMetrics {
  totalMilkProduction: number;
  avgDailyProductionPerAnimal: number;
  milkingAnimalsCount: number;
  avgDailyGain: number | null;
  mortalityRate: number;
  monthsOfData: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface CostStructure {
  operationalCosts: CostBreakdown[];
  totalOperational: number;
  capitalExpenses: { item: string; amount: number; date: string }[];
  totalCapital: number;
}

export interface RevenueBreakdown {
  source: string;
  amount: number;
  percentage: number;
}

export interface CashFlowStatement {
  revenueBreakdown: RevenueBreakdown[];
  grossRevenue: number;
  operationalCosts: number;
  netFarmIncome: number;
  personalExpenses: number;
  netCashAvailable: number;
}

export interface FinancialRatios {
  roi: number;
  breakevenPricePerLiter: number | null;
  currentSellingPrice: number | null;
  priceMargin: number | null;
  assetCoverageRatio: number | null;
  proposedLoanAmount: number | null;
}

export interface DataCompleteness {
  hasGeoLocation: boolean;
  hasAnimalInventory: boolean;
  hasWeightRecords: boolean;
  hasProductionRecords: boolean;
  hasExpenseTracking: boolean;
  hasRevenueDocumentation: boolean;
  hasFeedingRecords: boolean;
  hasFeedInventory: boolean;
  hasMilkInventory: boolean;
  monthsOfExpenseData: number;
  monthsOfRevenueData: number;
  missingItems: string[];
  completenessScore: number;
}

export interface FeedInventoryAsset {
  category: string;
  quantityKg: number;
  valuePhp: number;
}

export interface MilkInventoryAsset {
  quality: 'good' | 'rejected';
  litersRemaining: number;
  valuePhp: number;
  speciesBreakdown: { species: string; liters: number; pricePerLiter: number; value: number }[];
}

export interface CurrentAssets {
  feedInventory: FeedInventoryAsset[];
  feedInventoryTotal: number;
  milkInventoryGood: MilkInventoryAsset;
  milkInventoryRejected: MilkInventoryAsset;
  totalCurrentAssets: number;
}

export interface AccrualCostStructure extends CostStructure {
  feedCostBasis: 'accrual' | 'cash';
  feedConsumedAmount: number;
  feedPurchasedAmount: number;
  accrualTotalOperational: number;
  feedConsumptionNote: string | null;
}

export interface FinancialCapacityReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  farmProfile: FarmProfile;
  herdSummary: HerdSummary;
  currentAssets: CurrentAssets;
  productionMetrics: ProductionMetrics;
  costStructure: AccrualCostStructure;
  cashFlow: CashFlowStatement;
  financialRatios: FinancialRatios;
  dataCompleteness: DataCompleteness;
}

export async function generateFinancialReport(
  farmId: string,
  periodMonths: number = 6
): Promise<FinancialCapacityReport> {
  const now = new Date();
  const periodStart = startOfMonth(subMonths(now, periodMonths - 1));
  const periodEnd = endOfMonth(now);
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  console.log("[Financial Report] Generating report for farm:", farmId);
  console.log("[Financial Report] Date range:", periodStartStr, "to", periodEndStr);

  // Fetch all required data in parallel
  const [
    farmData,
    animalsData,
    expensesData,
    revenuesData,
    milkingData,
    weightData,
    valuationsData,
    marketPriceData,
    feedingRecordsData,
    feedInventoryData,
    milkInventoryData,
    milkPricesData,
  ] = await Promise.all([
    fetchFarmProfile(farmId),
    fetchAnimalsData(farmId),
    fetchExpensesData(farmId, periodStartStr, periodEndStr),
    fetchRevenuesData(farmId, periodStartStr, periodEndStr),
    fetchMilkingData(farmId, periodStartStr, periodEndStr),
    fetchWeightData(farmId),
    fetchValuationsData(farmId),
    fetchMarketPrice(farmId),
    fetchFeedingRecordsData(farmId, periodStartStr, periodEndStr),
    fetchFeedInventoryData(farmId),
    fetchMilkInventoryData(farmId),
    fetchMilkPrices(farmId),
  ]);

  // Log fetch results for debugging
  console.log("[Financial Report] Fetch results:", {
    farm: !!farmData,
    animalsCount: animalsData.length,
    expensesCount: expensesData.length,
    expensesTotal: expensesData.reduce((sum, e) => sum + Number(e.amount), 0),
    revenuesCount: revenuesData.length,
    revenuesTotal: revenuesData.reduce((sum, r) => sum + Number(r.amount), 0),
    milkingCount: milkingData.length,
    weightsCount: weightData.length,
    valuationsCount: valuationsData.length,
    feedingRecordsCount: feedingRecordsData.length,
    feedInventoryCount: feedInventoryData.length,
    milkInventoryCount: milkInventoryData.length,
  });

  // Process data into report sections
  const farmProfile = processFarmProfile(farmData, animalsData);
  const herdSummary = processHerdSummary(animalsData, valuationsData, weightData, marketPriceData);
  const currentAssets = processCurrentAssets(feedInventoryData, milkInventoryData, milkPricesData);
  const productionMetrics = processProductionMetrics(milkingData, weightData, animalsData, periodMonths);
  const costStructure = processAccrualCostStructure(expensesData, feedingRecordsData);
  const cashFlow = processCashFlow(revenuesData, expensesData);

  // Financial ratios use accrual costs for breakeven/ROI
  const accrualNetFarmIncome = cashFlow.grossRevenue - costStructure.accrualTotalOperational;
  const financialRatios = calculateFinancialRatios(
    accrualNetFarmIncome,
    herdSummary.totalValue,
    productionMetrics.totalMilkProduction,
    costStructure.accrualTotalOperational,
    milkingData
  );
  const dataCompleteness = assessDataCompleteness(
    farmData,
    animalsData,
    weightData,
    milkingData,
    expensesData,
    revenuesData,
    periodMonths,
    feedingRecordsData,
    feedInventoryData,
    milkInventoryData
  );

  return {
    generatedAt: new Date().toISOString(),
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    farmProfile,
    herdSummary,
    currentAssets,
    productionMetrics,
    costStructure,
    cashFlow,
    financialRatios,
    dataCompleteness,
  };
}

// Data fetching functions
async function fetchFarmProfile(farmId: string) {
  const { data: farm } = await supabase
    .from("farms")
    .select(`
      id,
      name,
      gps_lat,
      gps_lng,
      region,
      province,
      municipality,
      livestock_type,
      created_at,
      owner_id,
      biosecurity_level,
      water_source,
      distance_to_market_km,
      pcic_enrolled
    `)
    .eq("id", farmId)
    .single();

  // Fetch owner profile separately to avoid deep type instantiation
  let ownerName = "Unknown Owner";
  if (farm?.owner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", farm.owner_id)
      .single();
    ownerName = profile?.full_name || "Unknown Owner";
  }

  return { ...farm, ownerName };
}

async function fetchAnimalsData(farmId: string) {
  const { data: animals, error } = await supabase
    .from("animals")
    .select(`
      id, name, life_stage, acquisition_type, purchase_price, exit_date, exit_reason,
      current_weight_kg, entry_weight_kg, entry_weight_unknown, birth_weight_kg
    `)
    .eq("farm_id", farmId)
    .eq("is_deleted", false)
    .is("exit_date", null); // Only active animals

  if (error) {
    console.error("[Financial Report] Failed to fetch animals:", error);
  }
  return animals || [];
}

/**
 * Get effective weight for an animal, prioritizing sources:
 * 1. Latest weight from weight_records table
 * 2. current_weight_kg on animal record
 * 3. entry_weight_kg (if known, not marked unknown)
 * 4. birth_weight_kg
 */
function getAnimalEffectiveWeight(animal: any, weightRecords: any[]): number | null {
  // Priority 1: Latest weight from weight_records table
  const animalRecords = weightRecords
    .filter(w => w.animal_id === animal.id)
    .sort((a, b) => new Date(b.measurement_date).getTime() - new Date(a.measurement_date).getTime());
  
  if (animalRecords.length > 0 && animalRecords[0].weight_kg) {
    return Number(animalRecords[0].weight_kg);
  }
  
  // Priority 2: Current weight on animal record
  if (animal.current_weight_kg) {
    return Number(animal.current_weight_kg);
  }
  
  // Priority 3: Entry weight (if known)
  if (animal.entry_weight_kg && !animal.entry_weight_unknown) {
    return Number(animal.entry_weight_kg);
  }
  
  // Priority 4: Birth weight
  if (animal.birth_weight_kg) {
    return Number(animal.birth_weight_kg);
  }
  
  return null;
}

async function fetchExpensesData(farmId: string, startDate: string, endDate: string) {
  const { data: expenses, error } = await supabase
    .from("farm_expenses")
    .select("id, amount, category, allocation_type, expense_date, description")
    .eq("farm_id", farmId)
    .eq("is_deleted", false)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  if (error) {
    console.error("[Financial Report] Failed to fetch expenses:", error);
  }
  return expenses || [];
}

async function fetchRevenuesData(farmId: string, startDate: string, endDate: string) {
  const { data: revenues, error } = await supabase
    .from("farm_revenues")
    .select("id, amount, source, transaction_date, notes")
    .eq("farm_id", farmId)
    .eq("is_deleted", false)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate);

  if (error) {
    console.error("[Financial Report] Failed to fetch revenues:", error);
  }
  return revenues || [];
}

async function fetchMilkingData(farmId: string, startDate: string, endDate: string): Promise<any[]> {
  // First get animal IDs for this farm (milking_records links via animal_id, not farm_id)
  const { data: farmAnimals, error: animalsError } = await supabase
    .from("animals")
    .select("id")
    .eq("farm_id", farmId)
    .eq("is_deleted", false);
  
  if (animalsError) {
    console.error("[Financial Report] Failed to fetch farm animals for milking:", animalsError);
    return [];
  }
  
  const animalIds = (farmAnimals || []).map(a => a.id);
  
  if (animalIds.length === 0) {
    console.log("[Financial Report] No animals found for milking records");
    return [];
  }
  
  // Use explicit type casting to avoid deep type instantiation
  const client = supabase as any;
  const { data, error } = await client
    .from("milking_records")
    .select("id, liters, is_sold, price_per_liter, sale_amount, record_date, animal_id")
    .in("animal_id", animalIds)
    .gte("record_date", startDate)
    .lte("record_date", endDate);

  if (error) {
    console.error("[Financial Report] Failed to fetch milking records:", error);
  }
  console.log("[Financial Report] Fetched milking records:", data?.length || 0);
  return data || [];
}

async function fetchWeightData(farmId: string): Promise<any[]> {
  // First get animal IDs for this farm (weight_records links via animal_id, not farm_id)
  const { data: farmAnimals, error: animalsError } = await supabase
    .from("animals")
    .select("id")
    .eq("farm_id", farmId)
    .eq("is_deleted", false);
  
  if (animalsError) {
    console.error("[Financial Report] Failed to fetch farm animals for weights:", animalsError);
    return [];
  }
  
  const animalIds = (farmAnimals || []).map(a => a.id);
  
  if (animalIds.length === 0) {
    console.log("[Financial Report] No animals found for weight records");
    return [];
  }
  
  // Use explicit type casting to avoid deep type instantiation
  const client = supabase as any;
  const { data, error } = await client
    .from("weight_records")
    .select("id, animal_id, weight_kg, measurement_date")
    .in("animal_id", animalIds)
    .order("measurement_date", { ascending: true });

  if (error) {
    console.error("[Financial Report] Failed to fetch weight records:", error);
  }
  console.log("[Financial Report] Fetched weight records:", data?.length || 0);
  return data || [];
}

async function fetchValuationsData(farmId: string) {
  const { data: valuations, error } = await supabase
    .from("biological_asset_valuations")
    .select("id, animal_id, estimated_value, valuation_date, weight_kg, market_price_per_kg")
    .eq("farm_id", farmId)
    .order("valuation_date", { ascending: false });

  if (error) {
    console.error("[Financial Report] Failed to fetch valuations:", error);
  }
  console.log("[Financial Report] Fetched valuations:", valuations?.length || 0);
  return valuations || [];
}

interface MarketPriceResult {
  price: number;
  source: string;
}

async function fetchMarketPrice(farmId: string): Promise<MarketPriceResult> {
  try {
    // First, get the farm's livestock type
    const { data: farm } = await supabase
      .from("farms")
      .select("livestock_type")
      .eq("id", farmId)
      .single();
    
    const livestockType = farm?.livestock_type || "cattle";
    
    // Use the same RPC as the dashboard for consistency (SSOT)
    const { data: rpcResult, error } = await supabase.rpc("get_market_price", {
      p_livestock_type: livestockType,
      p_farm_id: farmId,
    });
    
    if (!error && rpcResult && Array.isArray(rpcResult) && rpcResult.length > 0) {
      const priceData = rpcResult[0];
      console.log("[Financial Report] Market price from RPC:", priceData);
      return {
        price: Number(priceData.price) || 300,
        source: priceData.source || "Default",
      };
    }
    
    console.log("[Financial Report] RPC failed or empty, using fallback price");
    return { price: 300, source: "Fallback" };
  } catch (err) {
    console.error("[Financial Report] fetchMarketPrice error:", err);
    return { price: 300, source: "Fallback" };
  }
}

async function fetchFeedingRecordsData(farmId: string, startDate: string, endDate: string): Promise<any[]> {
  const client = supabase as any;
  const { data, error } = await client
    .from("feeding_records")
    .select("id, kilograms, cost_per_kg_at_time, record_datetime, animal:animals!inner(farm_id)")
    .eq("animal.farm_id", farmId)
    .not("cost_per_kg_at_time", "is", null)
    .gte("record_datetime", startDate)
    .lte("record_datetime", endDate + "T23:59:59");

  if (error) {
    console.error("[Financial Report] Failed to fetch feeding records:", error);
  }
  console.log("[Financial Report] Fetched feeding records:", data?.length || 0);
  return data || [];
}

async function fetchFeedInventoryData(farmId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("feed_inventory")
    .select("id, feed_type, category, quantity_kg, cost_per_unit")
    .eq("farm_id", farmId);

  if (error) {
    console.error("[Financial Report] Failed to fetch feed inventory:", error);
  }
  console.log("[Financial Report] Fetched feed inventory:", data?.length || 0);
  return data || [];
}

async function fetchMilkInventoryData(farmId: string): Promise<any[]> {
  const client = supabase as any;
  const { data, error } = await client
    .from("milk_inventory")
    .select("id, liters_remaining, is_available, milk_quality, animal:animals!inner(livestock_type, farm_id)")
    .eq("animal.farm_id", farmId)
    .eq("is_available", true)
    .gte("liters_remaining", 0.05);

  if (error) {
    console.error("[Financial Report] Failed to fetch milk inventory:", error);
  }
  console.log("[Financial Report] Fetched milk inventory:", data?.length || 0);
  return data || [];
}

async function fetchMilkPrices(farmId: string): Promise<Record<string, number>> {
  const client = supabase as any;
  const { data, error } = await client
    .from("milking_records")
    .select("price_per_liter, created_at, animal:animals!inner(farm_id, livestock_type)")
    .eq("animal.farm_id", farmId)
    .eq("is_sold", true)
    .not("price_per_liter", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Financial Report] Failed to fetch milk prices:", error);
    return { cattle: 30, goat: 45, carabao: 35, sheep: 50 };
  }

  const priceMap: Record<string, number> = {};
  const seen = new Set<string>();
  for (const record of data || []) {
    const type = (record.animal as any)?.livestock_type;
    if (type && !seen.has(type)) {
      priceMap[type] = Number(record.price_per_liter);
      seen.add(type);
    }
  }

  return {
    cattle: priceMap.cattle ?? 30,
    goat: priceMap.goat ?? 45,
    carabao: priceMap.carabao ?? 35,
    sheep: priceMap.sheep ?? 50,
    ...priceMap,
  };
}

// Data processing functions
function processFarmProfile(farm: any, animals: any[]): FarmProfile {
  // Animals are now pre-filtered for active (exit_date IS NULL) in fetchAnimalsData
  const activeAnimals = animals;
  
  return {
    farmName: farm?.name || "Unknown Farm",
    ownerName: farm?.ownerName || "Unknown Owner",
    gpsLat: farm?.gps_lat,
    gpsLng: farm?.gps_lng,
    region: farm?.region,
    province: farm?.province,
    municipality: farm?.municipality,
    livestockType: farm?.livestock_type || "Cattle",
    totalActiveAnimals: activeAnimals.length,
    farmCreatedAt: farm?.created_at,
    // Bank-required fields
    biosecurityLevel: farm?.biosecurity_level || null,
    waterSource: farm?.water_source || null,
    distanceToMarketKm: farm?.distance_to_market_km || null,
    pcicEnrolled: farm?.pcic_enrolled || false,
  };
}

function processHerdSummary(
  animals: any[],
  valuations: any[],
  weights: any[],
  marketPriceData: MarketPriceResult
): HerdSummary {
  // Animals are now pre-filtered for active (exit_date IS NULL) in fetchAnimalsData
  const activeAnimals = animals;
  const marketPrice = marketPriceData.price;
  
  // Group by life_stage and acquisition_type
  const groupedAnimals: Record<string, { count: number; acquisitionType: string; value: number }> = {};
  
  // Track individual animal valuations for debugging
  const animalValuations: { name: string; weight: number | null; value: number; source: string }[] = [];
  
  activeAnimals.forEach((animal) => {
    const key = animal.life_stage || "Unknown";
    if (!groupedAnimals[key]) {
      groupedAnimals[key] = { count: 0, acquisitionType: animal.acquisition_type || "Unknown", value: 0 };
    }
    groupedAnimals[key].count++;
    
    // SSOT: Calculate value using weight × market price (same as dashboard)
    const effectiveWeight = getAnimalEffectiveWeight(animal, weights);
    let animalValue = 0;
    let valueSource = "none";
    
    if (effectiveWeight && effectiveWeight > 0) {
      // Priority 1: Weight × Market Price (SSOT pattern)
      animalValue = effectiveWeight * marketPrice;
      valueSource = `weight(${effectiveWeight}kg) × price(₱${marketPrice}/kg)`;
    } else {
      // Priority 2: Use existing valuation if available
      const latestValuation = valuations.find((v) => v.animal_id === animal.id);
      if (latestValuation?.estimated_value) {
        animalValue = Number(latestValuation.estimated_value);
        valueSource = "valuation_record";
      } else if (animal.purchase_price) {
        // Priority 3: Fall back to purchase price
        animalValue = Number(animal.purchase_price);
        valueSource = "purchase_price";
      }
    }
    
    groupedAnimals[key].value += animalValue;
    animalValuations.push({
      name: animal.name || animal.id,
      weight: effectiveWeight,
      value: animalValue,
      source: valueSource,
    });
  });

  const composition: HerdComposition[] = Object.entries(groupedAnimals).map(([category, data]) => ({
    category,
    count: data.count,
    acquisitionType: data.acquisitionType,
    estimatedValue: data.value,
  }));

  // Calculate average weight using all available weight sources (weight_records + animal fields)
  const weightsWithValues = activeAnimals
    .map(a => getAnimalEffectiveWeight(a, weights))
    .filter((w): w is number => w !== null && w > 0);
  
  const averageWeight = weightsWithValues.length > 0 
    ? weightsWithValues.reduce((sum, w) => sum + w, 0) / weightsWithValues.length 
    : null;
  
  const totalValue = composition.reduce((sum, c) => sum + c.estimatedValue, 0);

  console.log("[Financial Report] Herd valuation (SSOT):", {
    marketPrice,
    priceSource: marketPriceData.source,
    totalAnimals: activeAnimals.length,
    animalsWithWeight: weightsWithValues.length,
    averageWeight,
    totalValue,
    breakdown: animalValuations,
  });

  return {
    composition,
    totalAnimals: activeAnimals.length,
    totalValue,
    averageWeight,
    marketPricePerKg: marketPrice,
  };
}

function processProductionMetrics(
  milkingRecords: any[],
  weightRecords: any[],
  animals: any[],
  periodMonths: number
): ProductionMetrics {
  // Total milk production (using correct column name: liters)
  const totalMilkProduction = milkingRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0);
  
  // Unique milking animals
  const milkingAnimalIds = new Set(milkingRecords.map((r) => r.animal_id));
  const milkingAnimalsCount = milkingAnimalIds.size;
  
  // Average daily production per animal
  const daysInPeriod = periodMonths * 30;
  const avgDailyProductionPerAnimal = milkingAnimalsCount > 0 
    ? totalMilkProduction / daysInPeriod / milkingAnimalsCount 
    : 0;

  // Calculate ADG from weight records
  let avgDailyGain: number | null = null;
  const animalWeightGains: number[] = [];
  
  // Using correct column names: weight_kg and measurement_date
  const weightsByAnimal: Record<string, { weight: number; date: string }[]> = {};
  weightRecords.forEach((w) => {
    if (!weightsByAnimal[w.animal_id]) {
      weightsByAnimal[w.animal_id] = [];
    }
    weightsByAnimal[w.animal_id].push({ weight: Number(w.weight_kg), date: w.measurement_date });
  });

  Object.values(weightsByAnimal).forEach((records) => {
    if (records.length >= 2) {
      records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const first = records[0];
      const last = records[records.length - 1];
      const daysDiff = Math.max(1, Math.ceil(
        (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const gain = (last.weight - first.weight) / daysDiff;
      if (gain > 0) {
        animalWeightGains.push(gain);
      }
    }
  });

  if (animalWeightGains.length > 0) {
    avgDailyGain = animalWeightGains.reduce((sum, g) => sum + g, 0) / animalWeightGains.length;
  }

  // Mortality rate (animals that died / total animals over period)
  const deadAnimals = animals.filter(
    (a) => a.exit_type === "Death" || a.exit_type === "Mortality"
  );
  const mortalityRate = animals.length > 0 ? (deadAnimals.length / animals.length) * 100 : 0;

  return {
    totalMilkProduction,
    avgDailyProductionPerAnimal,
    milkingAnimalsCount,
    avgDailyGain,
    mortalityRate,
    monthsOfData: periodMonths,
  };
}

function processAccrualCostStructure(expenses: any[], feedingRecords: any[]): AccrualCostStructure {
  // Separate operational and capital expenses
  const operational = expenses.filter((e) => e.allocation_type !== "Personal");
  const capital = expenses.filter((e) =>
    e.category === "Equipment & Machinery" ||
    e.category === "Infrastructure" ||
    e.category === "Land & Buildings"
  );

  // Group operational by category
  const categoryTotals: Record<string, number> = {};
  operational.forEach((e) => {
    const category = e.category || "Other";
    categoryTotals[category] = (categoryTotals[category] || 0) + Number(e.amount);
  });

  // Accrual feed consumption cost from feeding_records
  const feedConsumedAmount = feedingRecords.reduce(
    (sum: number, r: any) => sum + ((r.kilograms || 0) * (r.cost_per_kg_at_time || 0)),
    0
  );
  const feedPurchasedAmount = categoryTotals["Feed & Supplements"] || 0;

  // Determine basis and substitute
  let feedCostBasis: 'accrual' | 'cash';
  let feedConsumptionNote: string | null = null;

  if (feedingRecords.length > 0) {
    feedCostBasis = 'accrual';
    delete categoryTotals["Feed & Supplements"];
    if (feedConsumedAmount > 0) {
      categoryTotals["Feed Consumed (Accrual)"] = feedConsumedAmount;
    }
  } else if (feedPurchasedAmount > 0) {
    feedCostBasis = 'cash';
    feedConsumptionNote =
      "Feed costs shown on cash basis (purchase date). " +
      "No feeding records available for accrual calculation.";
  } else {
    feedCostBasis = 'accrual';
  }

  const accrualTotalOperational = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

  const operationalCosts: CostBreakdown[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: accrualTotalOperational > 0 ? (amount / accrualTotalOperational) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const capitalExpenses = capital.map((e) => ({
    item: e.description || e.category || "Capital Expense",
    amount: Number(e.amount),
    date: e.expense_date,
  }));
  const totalCapital = capitalExpenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    operationalCosts,
    totalOperational: accrualTotalOperational,
    capitalExpenses,
    totalCapital,
    feedCostBasis,
    feedConsumedAmount,
    feedPurchasedAmount,
    accrualTotalOperational,
    feedConsumptionNote,
  };
}

function processCurrentAssets(
  feedInventory: any[],
  milkInventory: any[],
  milkPrices: Record<string, number>
): CurrentAssets {
  // Feed inventory grouped by category
  const feedByCategory: Record<string, { kg: number; value: number }> = {};
  feedInventory.forEach((item: any) => {
    const cat = item.category || "uncategorized";
    if (!feedByCategory[cat]) {
      feedByCategory[cat] = { kg: 0, value: 0 };
    }
    feedByCategory[cat].kg += Number(item.quantity_kg) || 0;
    feedByCategory[cat].value += (Number(item.quantity_kg) || 0) * (Number(item.cost_per_unit) || 0);
  });

  const feedAssets: FeedInventoryAsset[] = Object.entries(feedByCategory)
    .map(([category, data]) => ({
      category,
      quantityKg: data.kg,
      valuePhp: data.value,
    }))
    .sort((a, b) => b.valuePhp - a.valuePhp);

  const feedInventoryTotal = feedAssets.reduce((sum, a) => sum + a.valuePhp, 0);

  // Milk inventory — separate good vs rejected
  const goodMilk = milkInventory.filter((m: any) => m.milk_quality === "good");
  const rejectedMilk = milkInventory.filter((m: any) => m.milk_quality === "rejected");

  // Good milk valued at species-specific prices
  const goodBySpecies: Record<string, number> = {};
  goodMilk.forEach((m: any) => {
    const species = (m.animal as any)?.livestock_type || "cattle";
    goodBySpecies[species] = (goodBySpecies[species] || 0) + (Number(m.liters_remaining) || 0);
  });

  const goodSpeciesBreakdown = Object.entries(goodBySpecies).map(([species, liters]) => ({
    species,
    liters,
    pricePerLiter: milkPrices[species] || 30,
    value: liters * (milkPrices[species] || 30),
  }));

  const goodTotalLiters = goodSpeciesBreakdown.reduce((sum, s) => sum + s.liters, 0);
  const goodTotalValue = goodSpeciesBreakdown.reduce((sum, s) => sum + s.value, 0);

  const milkInventoryGood: MilkInventoryAsset = {
    quality: "good",
    litersRemaining: goodTotalLiters,
    valuePhp: goodTotalValue,
    speciesBreakdown: goodSpeciesBreakdown,
  };

  // Rejected milk valued at zero
  const rejectedTotalLiters = rejectedMilk.reduce(
    (sum: number, m: any) => sum + (Number(m.liters_remaining) || 0), 0
  );

  const milkInventoryRejected: MilkInventoryAsset = {
    quality: "rejected",
    litersRemaining: rejectedTotalLiters,
    valuePhp: 0,
    speciesBreakdown: [],
  };

  return {
    feedInventory: feedAssets,
    feedInventoryTotal,
    milkInventoryGood,
    milkInventoryRejected,
    totalCurrentAssets: feedInventoryTotal + goodTotalValue,
  };
}

function processCashFlow(revenues: any[], expenses: any[]): CashFlowStatement {
  // Group revenues by source
  const revenueTotals: Record<string, number> = {};
  revenues.forEach((r) => {
    const source = r.source || "Other";
    revenueTotals[source] = (revenueTotals[source] || 0) + Number(r.amount);
  });

  const grossRevenue = Object.values(revenueTotals).reduce((sum, v) => sum + v, 0);

  const revenueBreakdown: RevenueBreakdown[] = Object.entries(revenueTotals)
    .map(([source, amount]) => ({
      source,
      amount,
      percentage: grossRevenue > 0 ? (amount / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate costs
  const operationalExpenses = expenses.filter((e) => e.allocation_type !== "Personal");
  const personalExpenses = expenses.filter((e) => e.allocation_type === "Personal");

  const operationalCosts = operationalExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const personalTotal = personalExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const netFarmIncome = grossRevenue - operationalCosts;
  const netCashAvailable = netFarmIncome - personalTotal;

  return {
    revenueBreakdown,
    grossRevenue,
    operationalCosts,
    netFarmIncome,
    personalExpenses: personalTotal,
    netCashAvailable,
  };
}

function calculateFinancialRatios(
  netFarmIncome: number,
  totalHerdValue: number,
  totalMilkProduction: number,
  operationalCosts: number,
  milkingRecords: any[]
): FinancialRatios {
  // ROI
  const roi = totalHerdValue > 0 ? (netFarmIncome / totalHerdValue) * 100 : 0;

  // Breakeven price per liter
  const breakevenPricePerLiter = totalMilkProduction > 0 
    ? operationalCosts / totalMilkProduction 
    : null;

  // Current selling price (average from sold milk)
  const soldMilk = milkingRecords.filter((r) => r.is_sold && r.price_per_liter);
  const currentSellingPrice = soldMilk.length > 0
    ? soldMilk.reduce((sum, r) => sum + Number(r.price_per_liter), 0) / soldMilk.length
    : null;

  // Price margin
  const priceMargin = breakevenPricePerLiter && currentSellingPrice
    ? ((currentSellingPrice - breakevenPricePerLiter) / currentSellingPrice) * 100
    : null;

  return {
    roi,
    breakevenPricePerLiter,
    currentSellingPrice,
    priceMargin,
    assetCoverageRatio: null, // Requires proposed loan amount
    proposedLoanAmount: null,
  };
}

function assessDataCompleteness(
  farm: any,
  animals: any[],
  weights: any[],
  milking: any[],
  expenses: any[],
  revenues: any[],
  periodMonths: number,
  feedingRecords: any[],
  feedInventory: any[],
  milkInventory: any[]
): DataCompleteness {
  const missingItems: string[] = [];

  // 1. GPS Location check
  const hasGeoLocation = !!(farm?.gps_lat && farm?.gps_lng);
  if (!hasGeoLocation) missingItems.push("Farm GPS coordinates");

  // 2. Complete address check (aligned with Dashboard)
  const hasCompleteAddress = !!(farm?.region && farm?.province && farm?.municipality);
  if (!hasCompleteAddress) missingItems.push("Complete address (region/province/municipality)");

  // 3. Animal inventory check
  const hasAnimalInventory = animals.length > 0;
  if (!hasAnimalInventory) missingItems.push("Animal inventory");

  // 4. Weight records check - considers ALL weight sources (weight_records + animal fields)
  const animalsWithWeight = animals.filter(a =>
    getAnimalEffectiveWeight(a, weights) !== null
  ).length;
  const hasWeightRecords = animals.length > 0 && animalsWithWeight > 0;
  const weightCoverage = animals.length > 0 ? (animalsWithWeight / animals.length) * 100 : 0;
  if (!hasWeightRecords || weightCoverage < 80) {
    missingItems.push(`Animal weight records (${animalsWithWeight}/${animals.length} animals)`);
  }

  // 5. Production records check (aligned with Dashboard: >= 10 records in period)
  const PRODUCTION_THRESHOLD = 10;
  const hasProductionRecords = milking.length >= PRODUCTION_THRESHOLD;
  if (!hasProductionRecords) {
    missingItems.push(`Milk production records (${milking.length}/${PRODUCTION_THRESHOLD} minimum)`);
  }

  // 6. Expense tracking check (aligned with Dashboard: >= 5 records in period)
  const EXPENSE_THRESHOLD = 5;
  const hasExpenseTracking = expenses.length >= EXPENSE_THRESHOLD;
  if (!hasExpenseTracking) {
    missingItems.push(`Expense records (${expenses.length}/${EXPENSE_THRESHOLD} minimum)`);
  }

  // 7. Revenue documentation check (aligned with Dashboard: >= 3 records in period)
  const REVENUE_THRESHOLD = 3;
  const hasRevenueDocumentation = revenues.length >= REVENUE_THRESHOLD;
  if (!hasRevenueDocumentation) {
    missingItems.push(`Revenue records (${revenues.length}/${REVENUE_THRESHOLD} minimum)`);
  }

  // 8. Bank info fields check (aligned with Dashboard: 4 required fields)
  const bankFields = [
    farm?.biosecurity_level,
    farm?.water_source,
    farm?.distance_to_market_km,
    farm?.pcic_enrolled !== undefined && farm?.pcic_enrolled !== null
  ];
  const bankFieldsComplete = bankFields.filter(Boolean).length;
  const hasBankInfo = bankFieldsComplete >= 3; // At least 3 of 4 fields
  if (!hasBankInfo) {
    missingItems.push(`Bank info fields (${bankFieldsComplete}/4 complete)`);
  }

  // 9. Feeding records check (for accrual cost accuracy)
  const FEEDING_THRESHOLD = 5;
  const hasFeedingRecords = feedingRecords.length >= FEEDING_THRESHOLD;
  if (!hasFeedingRecords) {
    missingItems.push(`Feeding records (${feedingRecords.length}/${FEEDING_THRESHOLD} minimum for accrual costs)`);
  }

  // 10. Feed inventory check
  const hasFeedInventory = feedInventory.length > 0;
  if (!hasFeedInventory) {
    missingItems.push("Feed inventory data");
  }

  // 11. Milk inventory check
  const hasMilkInventory = milkInventory.length > 0;
  if (!hasMilkInventory) {
    missingItems.push("Milk inventory data");
  }

  // Calculate months of data for display
  const expenseDates = expenses.map((e) => new Date(e.expense_date));
  const revenueDates = revenues.map((r) => new Date(r.transaction_date));

  const oldestExpense = expenseDates.length > 0 ? Math.min(...expenseDates.map((d) => d.getTime())) : Date.now();
  const oldestRevenue = revenueDates.length > 0 ? Math.min(...revenueDates.map((d) => d.getTime())) : Date.now();

  const monthsOfExpenseData = Math.min(
    periodMonths,
    differenceInMonths(new Date(), new Date(oldestExpense)) + 1
  );
  const monthsOfRevenueData = Math.min(
    periodMonths,
    differenceInMonths(new Date(), new Date(oldestRevenue)) + 1
  );

  // Calculate completeness score (11 criteria)
  const checks = [
    hasGeoLocation,
    hasCompleteAddress,
    hasAnimalInventory,
    hasWeightRecords && weightCoverage >= 80,
    hasProductionRecords,
    hasExpenseTracking,
    hasRevenueDocumentation,
    hasBankInfo,
    hasFeedingRecords,
    hasFeedInventory,
    hasMilkInventory,
  ];

  const completenessScore = (checks.filter(Boolean).length / checks.length) * 100;

  console.log("[Financial Report] Data completeness assessment:", {
    hasGeoLocation,
    hasCompleteAddress,
    hasAnimalInventory,
    hasWeightRecords,
    weightCoverage: `${weightCoverage.toFixed(0)}%`,
    hasProductionRecords: `${milking.length} records`,
    hasExpenseTracking: `${expenses.length} records`,
    hasRevenueDocumentation: `${revenues.length} records`,
    hasBankInfo: `${bankFieldsComplete}/4`,
    hasFeedingRecords: `${feedingRecords.length} records`,
    hasFeedInventory: `${feedInventory.length} items`,
    hasMilkInventory: `${milkInventory.length} items`,
    completenessScore: `${completenessScore.toFixed(0)}%`,
    missingItems,
  });

  return {
    hasGeoLocation,
    hasAnimalInventory,
    hasWeightRecords,
    hasProductionRecords,
    hasExpenseTracking,
    hasRevenueDocumentation,
    hasFeedingRecords,
    hasFeedInventory,
    hasMilkInventory,
    monthsOfExpenseData,
    monthsOfRevenueData,
    missingItems,
    completenessScore,
  };
}

// Format currency helpers — delegate to SSOT (src/lib/currency.ts)
export const formatCurrency = (value: number): string => formatPHP(value);
export const formatCurrencyDecimal = (value: number): string => formatPHP(value, true);

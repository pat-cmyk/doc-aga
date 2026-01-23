import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format, differenceInMonths } from "date-fns";

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
  monthsOfExpenseData: number;
  monthsOfRevenueData: number;
  missingItems: string[];
  completenessScore: number;
}

export interface FinancialCapacityReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  farmProfile: FarmProfile;
  herdSummary: HerdSummary;
  productionMetrics: ProductionMetrics;
  costStructure: CostStructure;
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
  ] = await Promise.all([
    fetchFarmProfile(farmId),
    fetchAnimalsData(farmId),
    fetchExpensesData(farmId, periodStartStr, periodEndStr),
    fetchRevenuesData(farmId, periodStartStr, periodEndStr),
    fetchMilkingData(farmId, periodStartStr, periodEndStr),
    fetchWeightData(farmId),
    fetchValuationsData(farmId),
    fetchMarketPrice(farmId),
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
  });

  // Process data into report sections
  const farmProfile = processFarmProfile(farmData, animalsData);
  const herdSummary = processHerdSummary(animalsData, valuationsData, weightData, marketPriceData);
  const productionMetrics = processProductionMetrics(milkingData, weightData, animalsData, periodMonths);
  const costStructure = processCostStructure(expensesData);
  const cashFlow = processCashFlow(revenuesData, expensesData);
  const financialRatios = calculateFinancialRatios(
    cashFlow.netFarmIncome,
    herdSummary.totalValue,
    productionMetrics.totalMilkProduction,
    costStructure.totalOperational,
    milkingData
  );
  const dataCompleteness = assessDataCompleteness(
    farmData,
    animalsData,
    weightData,
    milkingData,
    expensesData,
    revenuesData,
    periodMonths
  );

  return {
    generatedAt: new Date().toISOString(),
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    farmProfile,
    herdSummary,
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
    .select("id, animal_id, fair_value, valuation_date")
    .eq("farm_id", farmId)
    .order("valuation_date", { ascending: false });

  if (error) {
    console.error("[Financial Report] Failed to fetch valuations:", error);
  }
  return valuations || [];
}

async function fetchMarketPrice(farmId: string): Promise<number> {
  try {
    // Try to get market price from biological asset valuations or use default
    const { data: valuations } = await supabase
      .from("biological_asset_valuations")
      .select("market_price_per_kg")
      .eq("farm_id", farmId)
      .order("valuation_date", { ascending: false })
      .limit(1);
    
    if (valuations && valuations.length > 0 && valuations[0].market_price_per_kg) {
      return Number(valuations[0].market_price_per_kg);
    }
    return 300; // Default ₱300/kg
  } catch {
    return 300;
  }
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
  marketPrice: number
): HerdSummary {
  // Animals are now pre-filtered for active (exit_date IS NULL) in fetchAnimalsData
  const activeAnimals = animals;
  
  // Group by life_stage and acquisition_type
  const groupedAnimals: Record<string, { count: number; acquisitionType: string; value: number }> = {};
  
  activeAnimals.forEach((animal) => {
    const key = animal.life_stage || "Unknown";
    if (!groupedAnimals[key]) {
      groupedAnimals[key] = { count: 0, acquisitionType: animal.acquisition_type || "Unknown", value: 0 };
    }
    groupedAnimals[key].count++;
    
    // Get latest valuation for this animal
    const latestValuation = valuations.find((v) => v.animal_id === animal.id);
    if (latestValuation) {
      groupedAnimals[key].value += Number(latestValuation.fair_value);
    } else if (animal.purchase_price) {
      groupedAnimals[key].value += Number(animal.purchase_price);
    }
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
  
  console.log("[Financial Report] Weight calculation:", {
    totalAnimals: activeAnimals.length,
    animalsWithWeight: weightsWithValues.length,
    averageWeight,
  });

  const totalValue = composition.reduce((sum, c) => sum + c.estimatedValue, 0);

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

function processCostStructure(expenses: any[]): CostStructure {
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

  const totalOperational = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

  const operationalCosts: CostBreakdown[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalOperational > 0 ? (amount / totalOperational) * 100 : 0,
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
    totalOperational,
    capitalExpenses,
    totalCapital,
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
  periodMonths: number
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

  // Calculate completeness score (8 criteria aligned with Dashboard)
  const checks = [
    hasGeoLocation,
    hasCompleteAddress,
    hasAnimalInventory,
    hasWeightRecords && weightCoverage >= 80,
    hasProductionRecords,
    hasExpenseTracking,
    hasRevenueDocumentation,
    hasBankInfo,
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
    monthsOfExpenseData,
    monthsOfRevenueData,
    missingItems,
    completenessScore,
  };
}

// Format currency helper
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyDecimal(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

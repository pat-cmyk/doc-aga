/**
 * Animal Profile Export — shared types
 *
 * Single source of truth for the shape of data passed to PDF and CSV renderers.
 * Composed from existing SSOT hooks (useBioCardData, useAnimalExpenses,
 * getCachedAnimalDetails, etc.) via `useAnimalProfileExport`.
 *
 * Governance: see docs/ssot-architecture.md — Animal Profile Export.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- row aliases are intentionally permissive passthroughs of cached Supabase rows */

export interface AnimalExportIdentity {
  id: string;
  name: string | null;
  ear_tag: string | null;
  gender: string | null;
  livestock_type: string;
  breed: string | null;
  birth_date: string | null;
  life_stage: string | null;
  milking_stage: string | null;
  fertility_status: string | null;
  current_weight_kg: number | null;
  entry_weight_kg: number | null;
  farm_entry_date: string | null;
  acquisition_type: string | null;
  purchase_price: number | null;
  avatar_url: string | null;
  parity: number | null;
}

export interface AnimalExportGenealogy {
  motherName: string | null;
  motherEarTag: string | null;
  fatherName: string | null;
  fatherEarTag: string | null;
  offspringCount: number;
}

export interface AnimalExportOVR {
  overall: number | null;
  production: number | null;
  health: number | null;
  fertility: number | null;
  growth: number | null;
  bodyCondition: number | null;
}

export interface AnimalExportVitals {
  currentWeightKg: number | null;
  latestBCS: number | null;
  daysInMilk: number | null;
  lastHeatDate: string | null;
  nextVaccineDueDate: string | null;
  immunityCompliancePercent: number | null;
  estimatedValuePhp: number | null;
  marketPricePerKg: number | null;
  isPregnant: boolean;
  expectedDeliveryDate: string | null;
}

export interface AnimalExportCostSummary {
  purchasePrice: number;
  manualExpenses: number;
  feedConsumptionCost: number;
  totalExpenses: number;
  totalInvested: number;
  categoryBreakdown: Array<{ category: string; amount: number }>;
}

// Record rows — intentionally permissive (any[]) since they come from cached
// Supabase row objects. Renderers pick the fields they need.
export type MilkingRow = Record<string, any>;
export type WeightRow = Record<string, any>;
export type FeedingRow = Record<string, any>;
export type HealthRow = Record<string, any>;
export type AiRow = Record<string, any>;
export type HeatRow = Record<string, any>;
export type BreedingEventRow = Record<string, any>;
export type BcsRow = Record<string, any>;

export interface AnimalExportRecords {
  milking: MilkingRow[];
  weight: WeightRow[];
  feeding: FeedingRow[];
  health: HealthRow[];
  ai: AiRow[];
  heat: HeatRow[];
  breeding: BreedingEventRow[];
  bcs: BcsRow[];
}

export interface AnimalExportSparklines {
  weight: Array<{ date: string; value: number }>;
  bcs: Array<{ date: string; value: number }>;
  milk: Array<{ date: string; value: number }>;
}

export interface AnimalExportMeta {
  generatedAt: string; // ISO
  sourceIsOffline: boolean;
  cacheLastUpdated: number | null; // epoch ms
  farmName: string | null;
  farmerName: string | null;
}

/**
 * Canonical payload passed to both PDF and CSV renderers.
 */
export interface AnimalProfileExportData {
  meta: AnimalExportMeta;
  identity: AnimalExportIdentity;
  genealogy: AnimalExportGenealogy;
  ovr: AnimalExportOVR;
  vitals: AnimalExportVitals;
  costs: AnimalExportCostSummary;
  records: AnimalExportRecords;
  sparklines: AnimalExportSparklines;
}

export type ExportFormat = 'pdf' | 'csv' | 'both';

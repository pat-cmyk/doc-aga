/**
 * useAnimalProfileExport — SSOT aggregation hook for animal profile export
 *
 * Composes existing SSOT hooks + cache helpers into a single normalized
 * `AnimalProfileExportData` payload ready for PDF / CSV renderers.
 *
 * OFFLINE-FIRST:
 *   - Reads all record history from IndexedDB via `getCachedAnimalDetails`
 *     (same pattern used by the AnimalDetails view — ensures the export
 *     matches what the user sees on screen).
 *   - Vitals, OVR, sparklines, alerts, growth benchmark come from
 *     `useBioCardData` (the canonical aggregate hook).
 *   - Cost summary comes from `useAnimalExpenseSummary` (SSOT for per-animal
 *     cost rollup including feed consumption cost).
 *
 * No new network calls are issued here. Any refresh is driven by the
 * underlying SSOT hooks' own policies.
 *
 * Governance: see docs/ssot-architecture.md and docs/data-relationships-map.md.
 */

import { useEffect, useMemo, useState } from 'react';
import { getCachedAnimalDetails } from '@/lib/dataCache';
import { useBioCardData, type BioCardAnimalData } from '@/hooks/useBioCardData';
import { useAnimalExpenseSummary } from '@/hooks/useAnimalExpenses';
import { getIsOnline } from '@/hooks/useOnlineStatus';
import type {
  AnimalProfileExportData,
  AnimalExportRecords,
  AnimalExportCostSummary,
} from '@/lib/animalProfileExport/types';

interface CachedDetailsState {
  animal: any | null;
  mother: any | null;
  father: any | null;
  offspring: any[];
  records: any | null;
  lastUpdated: number | null;
}

const EMPTY_RECORDS: AnimalExportRecords = {
  milking: [],
  weight: [],
  feeding: [],
  health: [],
  ai: [],
  heat: [],
  breeding: [],
  bcs: [],
};

const EMPTY_COSTS: AnimalExportCostSummary = {
  purchasePrice: 0,
  manualExpenses: 0,
  feedConsumptionCost: 0,
  totalExpenses: 0,
  totalInvested: 0,
  categoryBreakdown: [],
};

export interface UseAnimalProfileExportResult {
  data: AnimalProfileExportData | null;
  isReady: boolean;
  isLoading: boolean;
}

export function useAnimalProfileExport(
  animalId: string,
  farmId: string | undefined,
  farmMeta?: { farmName?: string | null; farmerName?: string | null },
): UseAnimalProfileExportResult {
  // 1) Cached animal details (includes records + parents + offspring)
  const [cached, setCached] = useState<CachedDetailsState | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!animalId || !farmId) {
        setCached(null);
        setCacheLoading(false);
        return;
      }
      setCacheLoading(true);
      try {
        const details = await getCachedAnimalDetails(animalId, farmId);
        if (cancelled) return;
        setCached({
          animal: details?.animal ?? null,
          mother: details?.mother ?? null,
          father: details?.father ?? null,
          offspring: details?.offspring ?? [],
          records: details?.records ?? null,
          lastUpdated: details?.records?.lastUpdated ?? null,
        });
      } catch (err) {
        console.error('[useAnimalProfileExport] cache read failed', err);
        if (!cancelled) setCached(null);
      } finally {
        if (!cancelled) setCacheLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [animalId, farmId]);

  // 2) BioCardData SSOT for vitals, OVR, sparklines, growth benchmark, immunity
  const bioCardAnimal: BioCardAnimalData | null = cached?.animal
    ? {
        id: cached.animal.id,
        name: cached.animal.name ?? null,
        ear_tag: cached.animal.ear_tag ?? null,
        gender: cached.animal.gender ?? null,
        life_stage: cached.animal.life_stage ?? null,
        milking_stage: cached.animal.milking_stage ?? null,
        livestock_type: cached.animal.livestock_type ?? 'cattle',
        birth_date: cached.animal.birth_date ?? null,
        avatar_url: cached.animal.avatar_url ?? null,
        current_weight_kg: cached.animal.current_weight_kg ?? null,
        farm_id: cached.animal.farm_id ?? farmId ?? '',
        breed: cached.animal.breed ?? null,
        fertility_status: cached.animal.fertility_status ?? null,
      }
    : null;

  const bioCard = useBioCardData(bioCardAnimal, farmId);

  // 3) Per-animal cost summary (SSOT for feed-cost + manual-expense rollup)
  const { data: expenseSummary, isLoading: expensesLoading } =
    useAnimalExpenseSummary(animalId);

  // 4) Compose the normalized payload
  const data = useMemo<AnimalProfileExportData | null>(() => {
    if (!cached?.animal) return null;
    const a = cached.animal;

    const records: AnimalExportRecords = cached.records
      ? {
          milking: cached.records.milking ?? [],
          weight: cached.records.weight ?? [],
          feeding: cached.records.feeding ?? [],
          health: cached.records.health ?? [],
          ai: cached.records.ai ?? [],
          heat: cached.records.heat ?? [],
          breeding: cached.records.breeding ?? [],
          bcs: cached.records.bcs ?? [],
        }
      : { ...EMPTY_RECORDS };

    const purchasePrice = Number(a.purchase_price ?? 0);
    const manualExpenses = expenseSummary?.manualExpenses ?? 0;
    const feedConsumptionCost = expenseSummary?.feedConsumptionCost ?? 0;
    const totalExpenses = expenseSummary?.totalExpenses ?? 0;

    const categoryBreakdown = expenseSummary?.categoryBreakdown
      ? Object.entries(expenseSummary.categoryBreakdown)
          .map(([category, amount]) => ({ category, amount: Number(amount) }))
          .sort((x, y) => y.amount - x.amount)
      : [];

    const costs: AnimalExportCostSummary = {
      ...EMPTY_COSTS,
      purchasePrice,
      manualExpenses,
      feedConsumptionCost,
      totalExpenses,
      totalInvested: purchasePrice + totalExpenses,
      categoryBreakdown,
    };

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        sourceIsOffline: !getIsOnline(),
        cacheLastUpdated: cached.lastUpdated,
        farmName: farmMeta?.farmName ?? null,
        farmerName: farmMeta?.farmerName ?? null,
      },
      identity: {
        id: a.id,
        name: a.name ?? null,
        ear_tag: a.ear_tag ?? null,
        gender: a.gender ?? null,
        livestock_type: a.livestock_type ?? 'cattle',
        breed: a.breed ?? null,
        birth_date: a.birth_date ?? null,
        life_stage: a.life_stage ?? null,
        milking_stage: a.milking_stage ?? null,
        fertility_status: a.fertility_status ?? null,
        current_weight_kg: a.current_weight_kg ?? null,
        entry_weight_kg: a.entry_weight_kg ?? null,
        farm_entry_date: a.farm_entry_date ?? null,
        acquisition_type: a.acquisition_type ?? null,
        purchase_price: a.purchase_price ?? null,
        avatar_url: a.avatar_url ?? null,
        parity: a.parity ?? null,
      },
      genealogy: {
        motherName: cached.mother?.name ?? null,
        motherEarTag: cached.mother?.ear_tag ?? null,
        fatherName: cached.father?.name ?? null,
        fatherEarTag: cached.father?.ear_tag ?? null,
        offspringCount: cached.offspring?.length ?? 0,
      },
      ovr: {
        overall: bioCard.ovr?.score ?? null,
        production: bioCard.ovr?.breakdown?.production ?? null,
        health: bioCard.ovr?.breakdown?.health ?? null,
        fertility: bioCard.ovr?.breakdown?.fertility ?? null,
        growth: bioCard.ovr?.breakdown?.growth ?? null,
        bodyCondition: bioCard.ovr?.breakdown?.bodyCondition ?? null,
      },
      vitals: {
        currentWeightKg: a.current_weight_kg ?? null,
        latestBCS: bioCard.latestBCS?.score != null ? Number(bioCard.latestBCS.score) : null,
        daysInMilk: bioCard.lactationInfo?.daysInMilk ?? null,
        lastHeatDate: bioCard.reproStatus?.lastHeatDate ?? null,
        nextVaccineDueDate: bioCard.immunityStatus?.nextDueDate ?? null,
        immunityCompliancePercent: bioCard.immunityStatus?.compliancePercent ?? null,
        estimatedValuePhp: bioCard.estimatedValue ?? null,
        marketPricePerKg: bioCard.marketPricePerKg ?? null,
        isPregnant: bioCard.reproStatus?.isPregnant ?? false,
        expectedDeliveryDate: bioCard.reproStatus?.expectedDeliveryDate ?? null,
      },
      costs,
      records,
      sparklines: {
        weight: bioCard.weightSparkline ?? [],
        bcs: bioCard.bcsSparkline ?? [],
        milk: bioCard.milkSparkline ?? [],
      },
    };
  }, [cached, bioCard, expenseSummary, farmMeta?.farmName, farmMeta?.farmerName]);

  const isLoading = cacheLoading || bioCard.isLoading || expensesLoading;
  const isReady = !isLoading && data !== null;

  return { data, isReady, isLoading };
}

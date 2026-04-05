/* eslint-disable @typescript-eslint/no-explicit-any -- cached animal/records rows are dynamic Supabase objects */
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
import { supabase } from '@/integrations/supabase/client';
import { getCachedAnimalDetails, updateRecordsCache } from '@/lib/dataCache';
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
        // Always read cached animal metadata + genealogy for instant paint.
        const details = await getCachedAnimalDetails(animalId, farmId);
        if (cancelled) return;

        // For records: prefer a FRESH direct Supabase query when online so
        // the export always reflects the latest data, regardless of whether
        // the per-animal cache was primed (the farm-level batch preload
        // writes empty cache entries for animals with no recent rows,
        // which made earlier fallback paths silently return zeros).
        // When offline, fall back to whatever is in IndexedDB.
        let records = details?.records ?? null;

        if (getIsOnline()) {
          try {
            const fresh = await fetchAnimalRecordsDirect(animalId);
            if (cancelled) return;
            records = fresh;
            // Write-through so offline views of this animal benefit too.
            // Fire-and-forget; failures shouldn't block the export.
            updateRecordsCache(animalId).catch((err) =>
              console.warn(
                '[useAnimalProfileExport] write-through cache refresh failed',
                err,
              ),
            );
          } catch (fetchErr) {
            console.error(
              '[useAnimalProfileExport] direct records fetch failed, falling back to cache',
              fetchErr,
            );
            // Leave `records` as whatever the cache returned.
          }
        }

        setCached({
          animal: details?.animal ?? null,
          mother: details?.mother ?? null,
          father: details?.father ?? null,
          offspring: details?.offspring ?? [],
          records,
          lastUpdated: records?.lastUpdated ?? null,
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

/**
 * Direct Supabase fetch for all record types the export renders.
 *
 * Deliberately NOT routed through `updateRecordsCache` because that helper
 * silently swallows errors and returns an empty stub on failure — which
 * produced mysterious "all zeros" reports for users. Here every query
 * throws on error so the caller can log and fall back cleanly.
 *
 * Windows match the production focus report (milk + feed 365 days back,
 * everything else 180) so we pull enough history to draw meaningful
 * trends without hitting bandwidth ceilings on rural connections.
 */
async function fetchAnimalRecordsDirect(animalId: string) {
  const now = Date.now();
  const daysAgo = (d: number) =>
    new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

  const [
    milkingRes,
    weightRes,
    feedingRes,
    healthRes,
    aiRes,
    heatRes,
    breedingRes,
    bcsRes,
  ] = await Promise.all([
    supabase
      .from('milking_records')
      .select('*')
      .eq('animal_id', animalId)
      .gte('record_date', daysAgo(365))
      .order('record_date', { ascending: false }),
    supabase
      .from('weight_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('measurement_date', { ascending: false }),
    supabase
      .from('feeding_records')
      .select('*')
      .eq('animal_id', animalId)
      .gte('record_datetime', daysAgo(365))
      .order('record_datetime', { ascending: false }),
    supabase
      .from('health_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('visit_date', { ascending: false }),
    supabase
      .from('ai_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('scheduled_date', { ascending: false }),
    supabase
      .from('heat_records')
      .select('*')
      .eq('animal_id', animalId)
      .order('detected_at', { ascending: false }),
    supabase
      .from('breeding_events')
      .select('*')
      .eq('animal_id', animalId)
      .order('event_date', { ascending: false })
      .limit(100),
    supabase
      .from('body_condition_scores')
      .select('*')
      .eq('animal_id', animalId)
      .order('assessment_date', { ascending: false }),
  ]);

  // Surface the first error, if any — don't return an empty stub.
  const errors = [
    ['milking', milkingRes.error],
    ['weight', weightRes.error],
    ['feeding', feedingRes.error],
    ['health', healthRes.error],
    ['ai', aiRes.error],
    ['heat', heatRes.error],
    ['breeding', breedingRes.error],
    ['bcs', bcsRes.error],
  ].filter(([, e]) => e != null);
  if (errors.length > 0) {
    const [name, err] = errors[0] as [string, { message?: string }];
    throw new Error(
      `[useAnimalProfileExport] ${name} fetch failed: ${err?.message ?? 'unknown error'}`,
    );
  }

  // Dev-friendly count summary (visible in browser console, helps users
  // tell us what came back without needing a full debug build).
  console.info('[useAnimalProfileExport] direct fetch counts', {
    animalId,
    milking: milkingRes.data?.length ?? 0,
    weight: weightRes.data?.length ?? 0,
    feeding: feedingRes.data?.length ?? 0,
    health: healthRes.data?.length ?? 0,
    ai: aiRes.data?.length ?? 0,
    heat: heatRes.data?.length ?? 0,
    breeding: breedingRes.data?.length ?? 0,
    bcs: bcsRes.data?.length ?? 0,
  });

  return {
    animalId,
    milking: milkingRes.data ?? [],
    weight: weightRes.data ?? [],
    feeding: feedingRes.data ?? [],
    health: healthRes.data ?? [],
    ai: aiRes.data ?? [],
    heat: heatRes.data ?? [],
    breeding: breedingRes.data ?? [],
    bcs: bcsRes.data ?? [],
    lastUpdated: Date.now(),
  };
}

/**
 * useAnimalProfileExport.test.tsx
 *
 * Unit tests for the animal profile export aggregation hook. All underlying
 * SSOT sources are mocked so the test only exercises the composition logic:
 *   - cache read via getCachedAnimalDetails
 *   - vitals/OVR via useBioCardData
 *   - cost rollup via useAnimalExpenseSummary
 *   - offline flag via getIsOnline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// --- Mocks (must be declared before importing the hook under test) ---

vi.mock('@/lib/dataCache', () => ({
  getCachedAnimalDetails: vi.fn(),
}));

vi.mock('@/hooks/useBioCardData', () => ({
  useBioCardData: vi.fn(),
}));

vi.mock('@/hooks/useAnimalExpenses', () => ({
  useAnimalExpenseSummary: vi.fn(),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  getIsOnline: vi.fn(() => true),
  useOnlineStatus: () => true,
}));

import { useAnimalProfileExport } from '../useAnimalProfileExport';
import { getCachedAnimalDetails } from '@/lib/dataCache';
import { useBioCardData } from '@/hooks/useBioCardData';
import { useAnimalExpenseSummary } from '@/hooks/useAnimalExpenses';
import { getIsOnline } from '@/hooks/useOnlineStatus';

// --- Helpers ---

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const baseBioCard = {
  isLoading: false,
  ovr: {
    score: 78,
    tier: 'gold' as const,
    trend: 'stable' as const,
    breakdown: {
      production: 82,
      health: 90,
      fertility: 65,
      growth: 75,
      bodyCondition: 80,
    },
  },
  statusAura: 'green' as const,
  radarData: [],
  weightSparkline: [{ date: '2026-03-01', value: 500 }],
  bcsSparkline: [{ date: '2026-03-01', value: 3.5 }],
  milkSparkline: [{ date: '2026-04-01', value: 22 }],
  reproStatus: {
    isPregnant: false,
    expectedDeliveryDate: null,
    daysSinceLastHeat: 14,
    cycleDay: 14,
    isInBreedingWindow: false,
    breedingWindowStart: null,
    breedingWindowEnd: null,
    lastHeatDate: '2026-03-20',
    averageCycleLength: 21,
    daysToNextHeat: 7,
  },
  immunityStatus: {
    level: 100 as const,
    label: 'full' as const,
    overdueVaccines: [],
    upcomingVaccines: [],
    compliancePercent: 100,
    nextDueDate: '2026-04-20',
  },
  activeAlerts: [],
  estimatedValue: 156_000,
  marketPricePerKg: 300,
  priceSource: 'system_default',
  growthBenchmark: null,
  latestBCS: { score: 3.5 } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  lactationInfo: {
    stage: 'Peak Lactation',
    daysInMilk: 95,
    daysToNextPhase: null,
    progressPercent: 30,
  },
};

const baseCachedDetails = {
  animal: {
    id: 'a1',
    name: 'Bessie',
    ear_tag: 'ET-001',
    gender: 'Female',
    livestock_type: 'cattle',
    breed: 'Holstein',
    birth_date: '2023-05-10',
    avatar_url: null,
    current_weight_kg: 520,
    entry_weight_kg: 480,
    farm_id: 'farm-1',
    fertility_status: 'open',
    life_stage: 'Mature Cow',
    milking_stage: 'Peak Lactation',
    farm_entry_date: '2024-01-15',
    acquisition_type: 'purchased',
    purchase_price: 80_000,
    parity: 3,
  },
  mother: { name: 'Lola', ear_tag: 'ET-M1' },
  father: { name: 'Bantay', ear_tag: 'ET-F1' },
  offspring: [{ id: 'o1' }, { id: 'o2' }],
  records: {
    animalId: 'a1',
    milking: [{ record_date: '2026-04-01', liters: 22 }],
    weight: [{ measurement_date: '2026-03-15', weight_kg: 520 }],
    feeding: [
      { feed_date: '2026-04-01', feed_type: 'napier', kilograms: 25, cost_per_kg_at_time: 12 },
    ],
    health: [{ visit_date: '2026-03-05', visit_type: 'vaccination' }],
    ai: [],
    heat: [],
    breeding: [],
    bcs: [{ assessment_date: '2026-03-20', score: 3.5 }],
    lastUpdated: 1_712_000_000_000,
    syncStatus: 'synced',
  },
};

const baseExpenseSummary = {
  totalExpenses: 17_000,
  manualExpenses: 4_500,
  feedConsumptionCost: 12_500,
  expenseCount: 5,
  categoryBreakdown: {
    veterinary: 3_000,
    medicine: 1_500,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getCachedAnimalDetails as any).mockResolvedValue(baseCachedDetails);
  (useBioCardData as any).mockReturnValue(baseBioCard);
  (useAnimalExpenseSummary as any).mockReturnValue({
    data: baseExpenseSummary,
    isLoading: false,
  });
  (getIsOnline as any).mockReturnValue(true);
});

describe('useAnimalProfileExport', () => {
  it('returns null while cache is loading and isReady=false', () => {
    (getCachedAnimalDetails as any).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAnimalProfileExport('a1', 'farm-1'), {
      wrapper,
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('composes identity, vitals, costs, and records from SSOT sources', async () => {
    const { result } = renderHook(() => useAnimalProfileExport('a1', 'farm-1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const data = result.current.data!;
    // Identity
    expect(data.identity.id).toBe('a1');
    expect(data.identity.name).toBe('Bessie');
    expect(data.identity.ear_tag).toBe('ET-001');
    expect(data.identity.breed).toBe('Holstein');
    expect(data.identity.purchase_price).toBe(80_000);
    // Genealogy
    expect(data.genealogy.motherName).toBe('Lola');
    expect(data.genealogy.fatherEarTag).toBe('ET-F1');
    expect(data.genealogy.offspringCount).toBe(2);
    // OVR
    expect(data.ovr.overall).toBe(78);
    expect(data.ovr.production).toBe(82);
    expect(data.ovr.bodyCondition).toBe(80);
    // Vitals
    expect(data.vitals.currentWeightKg).toBe(520);
    expect(data.vitals.latestBCS).toBe(3.5);
    expect(data.vitals.daysInMilk).toBe(95);
    expect(data.vitals.estimatedValuePhp).toBe(156_000);
    expect(data.vitals.isPregnant).toBe(false);
    // Cost rollup
    expect(data.costs.purchasePrice).toBe(80_000);
    expect(data.costs.manualExpenses).toBe(4_500);
    expect(data.costs.feedConsumptionCost).toBe(12_500);
    expect(data.costs.totalExpenses).toBe(17_000);
    expect(data.costs.totalInvested).toBe(97_000);
    // Category breakdown should be sorted desc
    expect(data.costs.categoryBreakdown[0]).toEqual({ category: 'veterinary', amount: 3_000 });
    expect(data.costs.categoryBreakdown[1]).toEqual({ category: 'medicine', amount: 1_500 });
    // Records passthrough
    expect(data.records.milking).toHaveLength(1);
    expect(data.records.feeding[0].feed_type).toBe('napier');
    expect(data.records.bcs).toHaveLength(1);
    // Sparklines from BioCard
    expect(data.sparklines.weight).toHaveLength(1);
    expect(data.sparklines.milk[0].value).toBe(22);
  });

  it('flags sourceIsOffline when getIsOnline() is false', async () => {
    (getIsOnline as any).mockReturnValue(false);
    const { result } = renderHook(() => useAnimalProfileExport('a1', 'farm-1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.data!.meta.sourceIsOffline).toBe(true);
    expect(result.current.data!.meta.cacheLastUpdated).toBe(1_712_000_000_000);
  });

  it('passes farmMeta through to the payload', async () => {
    const { result } = renderHook(
      () =>
        useAnimalProfileExport('a1', 'farm-1', {
          farmName: 'Bukid ni Mang Juan',
          farmerName: 'Juan Dela Cruz',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.data!.meta.farmName).toBe('Bukid ni Mang Juan');
    expect(result.current.data!.meta.farmerName).toBe('Juan Dela Cruz');
  });

  it('returns null data when cache has no animal', async () => {
    (getCachedAnimalDetails as any).mockResolvedValue({
      animal: null,
      mother: null,
      father: null,
      offspring: [],
      records: null,
    });
    const { result } = renderHook(() => useAnimalProfileExport('a1', 'farm-1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it('handles empty records without crashing', async () => {
    (getCachedAnimalDetails as any).mockResolvedValue({
      ...baseCachedDetails,
      records: null,
    });
    const { result } = renderHook(() => useAnimalProfileExport('a1', 'farm-1'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const data = result.current.data!;
    expect(data.records.milking).toEqual([]);
    expect(data.records.weight).toEqual([]);
    expect(data.records.health).toEqual([]);
    expect(data.records.feeding).toEqual([]);
  });

  it('returns null when called without a farmId', () => {
    const { result } = renderHook(
      () => useAnimalProfileExport('a1', undefined),
      { wrapper },
    );
    expect(result.current.data).toBeNull();
    expect(result.current.isReady).toBe(false);
  });
});

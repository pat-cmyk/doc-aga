/**
 * useBreedingAnalytics - Farm-level breeding performance metrics
 * 
 * Cache-first pattern: IndexedDB → Supabase → update cache
 * Uses a single consolidated useQuery with internal parallel fetches.
 * 
 * Calculates key reproductive efficiency indicators:
 * - Services per Conception (SPC)
 * - Calving Interval (CI)
 * - Heat Detection Rate (HDR)
 * - Breeding Season metrics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { getCachedBreedingAnalytics, updateBreedingAnalyticsCache } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

// Industry benchmarks by livestock type
export const SPC_BENCHMARKS = {
  cattle: { excellent: 1.5, good: 2.0 },
  goat: { excellent: 1.8, good: 2.5 },
} as const;

export const CALVING_INTERVAL_BENCHMARKS = {
  cattle: { optimal: 400, acceptable: 450 },
  goat: { optimal: 270, acceptable: 300 },
} as const;

export const CYCLE_LENGTH_DAYS = {
  cattle: 21,
  goat: 21,
} as const;

export const CONCEPTION_RATE_BENCHMARKS = {
  cattle: { excellent: 55, good: 45 },
  goat: { excellent: 65, good: 50 },
} as const;

export const DAYS_OPEN_BENCHMARKS = {
  cattle: { excellent: 100, good: 130 },
  goat: { excellent: 80, good: 110 },
} as const;

export interface RepeatBreeder {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  services_this_cycle: number;
}

export interface CalvingIntervalAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  interval_days: number;
  last_calving_date: string;
}

export interface BreedingAnalytics {
  // Services per Conception
  avgServicesPerConception: number;
  spcByLivestockType: Record<string, number>;
  repeatBreeders: RepeatBreeder[];
  totalAIServices: number;
  totalConfirmedPregnancies: number;
  
  // Calving Interval
  avgCalvingIntervalDays: number;
  calvingIntervalDistribution: { range: string; count: number; livestock: string }[];
  longestIntervalAnimals: CalvingIntervalAnimal[];
  animalsWithIntervalData: number;
  
  // Heat Detection Rate
  heatDetectionRate: number;
  expectedHeats: number;
  detectedHeats: number;
  avgCycleLengthDays: number;
  openCyclingCount: number;
  detectionMethodBreakdown: Record<string, number>;
  
  // Conception & Pregnancy Efficiency
  conceptionRate: number;               // (confirmed / performed AI) × 100
  avgDaysOpen: number;                  // avg days from calving to next confirmed conception
  twentyOneDayPregnancyRate: number;    // HDR × CR composite — gold-standard KPI

  // Breeding Season (optional)
  breedingSeason: {
    isActive: boolean;
    seasonName: string;
    aiThisSeason: number;
    conceptionRate: number;
  } | null;

  // Time period
  periodDays: number;
  
  isLoading: boolean;
  error: Error | null;
}

interface UseBreedingAnalyticsOptions {
  periodDays?: number; // Default 90 days lookback
  enableSeasonalView?: boolean;
}

export function useBreedingAnalytics(
  farmId: string | null,
  options: UseBreedingAnalyticsOptions = {}
): BreedingAnalytics {
  const { periodDays = 90, enableSeasonalView = false } = options;
  const isOnline = useOnlineStatus();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['breeding-analytics', farmId, periodDays, enableSeasonalView],
    queryFn: async (): Promise<Omit<BreedingAnalytics, 'isLoading' | 'error'>> => {
      if (!farmId) return getEmptyAnalytics(periodDays, enableSeasonalView);

      // 1. Check IndexedDB cache first
      const cached = await getCachedBreedingAnalytics(farmId);
      if (cached) {
        if (!isOnline) return cached.data;
        return cached.data;
      }

      // 2. If offline with no cache, return empty
      if (!isOnline) return getEmptyAnalytics(periodDays, enableSeasonalView);

      // 3. Online: parallel fetch all data
      const periodStart = startOfDay(subDays(new Date(), periodDays));
      const periodEnd = endOfDay(new Date());

      const animalsResult = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, gender, fertility_status, parity, last_calving_date, services_this_cycle')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null);

      if (animalsResult.error) throw animalsResult.error;
      const animals = animalsResult.data || [];
      const farmAnimalIds = animals.map(a => a.id);

      if (farmAnimalIds.length === 0) {
        const empty = getEmptyAnalytics(periodDays, enableSeasonalView);
        await updateBreedingAnalyticsCache(farmId, empty);
        return empty;
      }

      const [aiResult, heatResult, calvingResult] = await Promise.all([
        supabase
          .from('ai_records')
          .select('id, animal_id, performed_date, pregnancy_confirmed, confirmed_at')
          .in('animal_id', farmAnimalIds)
          .not('performed_date', 'is', null),
        
        supabase
          .from('heat_records')
          .select('id, animal_id, detected_at, detection_method, heat_intensity')
          .in('animal_id', farmAnimalIds)
          .gte('detected_at', periodStart.toISOString())
          .lte('detected_at', periodEnd.toISOString()),
        
        supabase
          .from('breeding_events')
          .select('id, animal_id, event_date, event_type, metadata')
          .in('animal_id', farmAnimalIds)
          .eq('event_type', 'calving')
          .order('event_date', { ascending: false }),
      ]);

      const aiRecords = aiResult.data || [];
      const heatRecords = heatResult.data || [];
      const calvingEvents = calvingResult.data || [];

      // 4. Compute analytics
      const spc = calculateSPC(animals, aiRecords);
      const ci = calculateCalvingInterval(animals, calvingEvents);
      const hdr = calculateHDR(animals, heatRecords, periodDays);
      const breedingSeason = enableSeasonalView ? calculateBreedingSeason(aiRecords) : null;

      // New KPIs: Conception Rate, Days Open, 21-Day Pregnancy Rate
      const cr = calculateConceptionRate(aiRecords);
      const daysOpen = calculateDaysOpen(animals, aiRecords);
      const pregnancyRate = hdr.rate > 0 && cr > 0
        ? (hdr.rate / 100) * (cr / 100) * 100
        : 0;

      const result = {
        avgServicesPerConception: spc.avgSPC,
        spcByLivestockType: spc.byLivestock,
        repeatBreeders: spc.repeatBreeders,
        totalAIServices: spc.totalServices,
        totalConfirmedPregnancies: spc.confirmedPregnancies,
        avgCalvingIntervalDays: ci.avgInterval,
        calvingIntervalDistribution: ci.distribution,
        longestIntervalAnimals: ci.longestAnimals,
        animalsWithIntervalData: ci.animalsWithData,
        heatDetectionRate: hdr.rate,
        expectedHeats: hdr.expected,
        detectedHeats: hdr.detected,
        avgCycleLengthDays: hdr.avgCycle,
        openCyclingCount: hdr.openCycling,
        detectionMethodBreakdown: hdr.methodBreakdown,
        conceptionRate: cr,
        avgDaysOpen: daysOpen,
        twentyOneDayPregnancyRate: pregnancyRate,
        breedingSeason,
        periodDays,
      };

      // 5. Update cache
      await updateBreedingAnalyticsCache(farmId, result);

      return result;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });

  if (!data) {
    return { ...getEmptyAnalytics(periodDays, enableSeasonalView), isLoading, error: error as Error | null };
  }

  return { ...data, isLoading, error: error as Error | null };
}

function getEmptyAnalytics(periodDays: number, enableSeasonalView: boolean): Omit<BreedingAnalytics, 'isLoading' | 'error'> {
  return {
    avgServicesPerConception: 0,
    spcByLivestockType: {},
    repeatBreeders: [],
    totalAIServices: 0,
    totalConfirmedPregnancies: 0,
    avgCalvingIntervalDays: 0,
    calvingIntervalDistribution: [],
    longestIntervalAnimals: [],
    animalsWithIntervalData: 0,
    heatDetectionRate: 0,
    expectedHeats: 0,
    detectedHeats: 0,
    avgCycleLengthDays: 21,
    openCyclingCount: 0,
    detectionMethodBreakdown: {},
    conceptionRate: 0,
    avgDaysOpen: 0,
    twentyOneDayPregnancyRate: 0,
    breedingSeason: enableSeasonalView ? { isActive: false, seasonName: '', aiThisSeason: 0, conceptionRate: 0 } : null,
    periodDays,
  };
}

// ============ Calculation Helpers ============

function calculateSPC(animals: any[], aiRecords: any[]) {
  const femaleAnimals = animals.filter(a => a.gender?.toLowerCase() === 'female');
  const confirmedPregnancies = aiRecords.filter(r => r.pregnancy_confirmed === true).length;
  const totalServices = aiRecords.filter(r => r.performed_date).length;
  const avgSPC = confirmedPregnancies > 0 ? totalServices / confirmedPregnancies : 0;
  
  const byLivestock: Record<string, number> = {};
  const livestockTypes = [...new Set(femaleAnimals.map(a => a.livestock_type))];
  
  for (const type of livestockTypes) {
    const typeAnimalIds = femaleAnimals.filter(a => a.livestock_type === type).map(a => a.id);
    const typeAI = aiRecords.filter(r => typeAnimalIds.includes(r.animal_id));
    const typeConfirmed = typeAI.filter(r => r.pregnancy_confirmed === true).length;
    const typeServices = typeAI.filter(r => r.performed_date).length;
    byLivestock[type] = typeConfirmed > 0 ? typeServices / typeConfirmed : 0;
  }
  
  const repeatBreeders: RepeatBreeder[] = femaleAnimals
    .filter(a => (a.services_this_cycle || 0) >= 3)
    .map(a => ({
      id: a.id, name: a.name, ear_tag: a.ear_tag,
      livestock_type: a.livestock_type, services_this_cycle: a.services_this_cycle || 0,
    }))
    .sort((a, b) => b.services_this_cycle - a.services_this_cycle);
  
  return { avgSPC, byLivestock, repeatBreeders, totalServices, confirmedPregnancies };
}

function calculateCalvingInterval(animals: any[], calvingEvents: any[]) {
  const eventsByAnimal: Record<string, any[]> = {};
  for (const event of calvingEvents) {
    if (!eventsByAnimal[event.animal_id]) eventsByAnimal[event.animal_id] = [];
    eventsByAnimal[event.animal_id].push(event);
  }
  
  const intervals: { animal: any; interval: number }[] = [];
  
  for (const animal of animals) {
    const events = eventsByAnimal[animal.id] || [];
    events.sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    
    if (events.length >= 2) {
      const interval = differenceInDays(new Date(events[0].event_date), new Date(events[1].event_date));
      if (interval > 0 && interval < 1000) intervals.push({ animal, interval });
    }
  }
  
  const avgInterval = intervals.length > 0
    ? intervals.reduce((sum, i) => sum + i.interval, 0) / intervals.length : 0;
  
  const ranges = [
    { min: 0, max: 365, label: '<365d' },
    { min: 365, max: 400, label: '365-400d' },
    { min: 400, max: 450, label: '400-450d' },
    { min: 450, max: 500, label: '450-500d' },
    { min: 500, max: Infinity, label: '>500d' },
  ];
  
  const distribution = ranges.map(range => ({
    range: range.label,
    count: intervals.filter(i => i.interval >= range.min && i.interval < range.max).length,
    livestock: 'all',
  }));
  
  const longestAnimals: CalvingIntervalAnimal[] = intervals
    .sort((a, b) => b.interval - a.interval)
    .slice(0, 5)
    .map(i => ({
      id: i.animal.id, name: i.animal.name, ear_tag: i.animal.ear_tag,
      livestock_type: i.animal.livestock_type, interval_days: i.interval,
      last_calving_date: i.animal.last_calving_date || '',
    }));
  
  return { avgInterval, distribution, longestAnimals, animalsWithData: intervals.length };
}

function calculateHDR(animals: any[], heatRecords: any[], periodDays: number) {
  const openCyclingStatuses = ['open_cycling', 'in_heat'];
  const openCycling = animals.filter(a => 
    a.gender?.toLowerCase() === 'female' && openCyclingStatuses.includes(a.fertility_status)
  ).length;
  
  const avgCycle = 21;
  const expectedHeats = openCycling * (periodDays / avgCycle);
  const detectedHeats = heatRecords.length;
  const rate = expectedHeats > 0 ? Math.min(100, (detectedHeats / expectedHeats) * 100) : 0;
  
  const methodBreakdown: Record<string, number> = {};
  for (const record of heatRecords) {
    const method = record.detection_method || 'unknown';
    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
  }
  
  return { rate, expected: Math.round(expectedHeats), detected: detectedHeats, avgCycle, openCycling, methodBreakdown };
}

function calculateBreedingSeason(aiRecords: any[]) {
  const now = new Date();
  const month = now.getMonth();
  const isWetSeason = month >= 5 && month <= 10;
  const seasonName = isWetSeason ? 'Wet Season' : 'Dry Season';
  
  const seasonStart = isWetSeason 
    ? new Date(now.getFullYear(), 5, 1)
    : new Date(now.getFullYear(), 11, 1);
  
  const seasonAI = aiRecords.filter(r => r.performed_date && new Date(r.performed_date) >= seasonStart);
  const confirmed = seasonAI.filter(r => r.pregnancy_confirmed === true).length;
  const conceptionRate = seasonAI.length > 0 ? (confirmed / seasonAI.length) * 100 : 0;
  
  return { isActive: true, seasonName, aiThisSeason: seasonAI.length, conceptionRate };
}

// Helper to get SPC status color
export function getSPCStatus(spc: number, livestockType: string): 'excellent' | 'good' | 'needs_improvement' {
  const benchmarks = SPC_BENCHMARKS[livestockType as keyof typeof SPC_BENCHMARKS] || SPC_BENCHMARKS.cattle;
  if (spc === 0) return 'good';
  if (spc <= benchmarks.excellent) return 'excellent';
  if (spc <= benchmarks.good) return 'good';
  return 'needs_improvement';
}

// Helper to get CI status color
export function getCIStatus(interval: number, livestockType: string): 'optimal' | 'acceptable' | 'too_long' {
  const benchmarks = CALVING_INTERVAL_BENCHMARKS[livestockType as keyof typeof CALVING_INTERVAL_BENCHMARKS] || CALVING_INTERVAL_BENCHMARKS.cattle;
  if (interval === 0) return 'optimal';
  if (interval <= benchmarks.optimal) return 'optimal';
  if (interval <= benchmarks.acceptable) return 'acceptable';
  return 'too_long';
}

// Helper to get HDR status
export function getHDRStatus(rate: number): 'excellent' | 'good' | 'needs_improvement' {
  if (rate >= 70) return 'excellent';
  if (rate >= 50) return 'good';
  return 'needs_improvement';
}

// Helper to get conception rate status
export function getConceptionRateStatus(rate: number, livestockType: string): 'excellent' | 'good' | 'needs_improvement' {
  const benchmarks = CONCEPTION_RATE_BENCHMARKS[livestockType as keyof typeof CONCEPTION_RATE_BENCHMARKS] || CONCEPTION_RATE_BENCHMARKS.cattle;
  if (rate === 0) return 'good';
  if (rate >= benchmarks.excellent) return 'excellent';
  if (rate >= benchmarks.good) return 'good';
  return 'needs_improvement';
}

// Helper to get days open status
export function getDaysOpenStatus(days: number, livestockType: string): 'excellent' | 'good' | 'needs_improvement' {
  const benchmarks = DAYS_OPEN_BENCHMARKS[livestockType as keyof typeof DAYS_OPEN_BENCHMARKS] || DAYS_OPEN_BENCHMARKS.cattle;
  if (days === 0) return 'good';
  if (days <= benchmarks.excellent) return 'excellent';
  if (days <= benchmarks.good) return 'good';
  return 'needs_improvement';
}

// ============ New KPI Calculations ============

/**
 * Conception Rate = (confirmed pregnancies / total AI performed) × 100
 * Uses all-time AI records (not date-filtered) for accuracy.
 */
function calculateConceptionRate(aiRecords: any[]): number {
  const performed = aiRecords.filter(r => r.performed_date).length;
  const confirmed = aiRecords.filter(r => r.pregnancy_confirmed === true).length;
  return performed > 0 ? Math.round((confirmed / performed) * 100) : 0;
}

/**
 * Days Open = average days from last_calving_date to next conception (AI confirmed)
 * Only for animals with parity >= 1 and a confirmed AI after calving.
 */
function calculateDaysOpen(animals: any[], aiRecords: any[]): number {
  const daysOpenValues: number[] = [];

  for (const animal of animals) {
    if (!animal.last_calving_date || (animal.parity || 0) < 1) continue;

    const calvingDate = new Date(animal.last_calving_date);

    // Find the first confirmed AI after this calving date
    const confirmedAI = aiRecords
      .filter(r =>
        r.animal_id === animal.id &&
        r.pregnancy_confirmed === true &&
        r.performed_date &&
        new Date(r.performed_date) >= calvingDate
      )
      .sort((a: any, b: any) =>
        new Date(a.performed_date).getTime() - new Date(b.performed_date).getTime()
      )[0];

    if (confirmedAI) {
      const days = differenceInDays(new Date(confirmedAI.performed_date), calvingDate);
      if (days > 0 && days < 500) daysOpenValues.push(days);
    }
  }

  return daysOpenValues.length > 0
    ? Math.round(daysOpenValues.reduce((sum, d) => sum + d, 0) / daysOpenValues.length)
    : 0;
}

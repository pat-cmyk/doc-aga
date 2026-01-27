/**
 * useBreedingAnalytics - Farm-level breeding performance metrics
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
  
  const periodStart = startOfDay(subDays(new Date(), periodDays));
  const periodEnd = endOfDay(new Date());
  
  // Fetch farm animals for context
  const { data: animals = [], isLoading: animalsLoading } = useQuery({
    queryKey: ['breeding-analytics-animals', farmId],
    queryFn: async () => {
      if (!farmId) return [];
      
      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, livestock_type, gender, fertility_status, parity, last_calving_date, services_this_cycle')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
  
  // Get farm animal IDs for filtering
  const farmAnimalIds = animals.map(a => a.id);
  
  // Fetch AI records for SPC calculation
  const { data: aiRecords = [], isLoading: aiLoading } = useQuery({
    queryKey: ['breeding-analytics-ai', farmId, periodDays],
    queryFn: async () => {
      if (!farmId || farmAnimalIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('ai_records')
        .select('id, animal_id, performed_date, pregnancy_confirmed, confirmed_at')
        .in('animal_id', farmAnimalIds)
        .not('performed_date', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId && farmAnimalIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch heat records for HDR calculation
  const { data: heatRecords = [], isLoading: heatLoading } = useQuery({
    queryKey: ['breeding-analytics-heat', farmId, periodDays],
    queryFn: async () => {
      if (!farmId || farmAnimalIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('heat_records')
        .select('id, animal_id, detected_at, detection_method, heat_intensity')
        .in('animal_id', farmAnimalIds)
        .gte('detected_at', periodStart.toISOString())
        .lte('detected_at', periodEnd.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId && farmAnimalIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch calving events for CI calculation
  const { data: calvingEvents = [], isLoading: calvingLoading } = useQuery({
    queryKey: ['breeding-analytics-calving', farmId],
    queryFn: async () => {
      if (!farmId || farmAnimalIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('breeding_events')
        .select('id, animal_id, event_date, event_type, metadata')
        .in('animal_id', farmAnimalIds)
        .eq('event_type', 'calving')
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId && farmAnimalIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  
  const isLoading = animalsLoading || aiLoading || heatLoading || calvingLoading;
  
  // Calculate Services per Conception
  const spcCalculation = calculateSPC(animals, aiRecords);
  
  // Calculate Calving Interval
  const ciCalculation = calculateCalvingInterval(animals, calvingEvents);
  
  // Calculate Heat Detection Rate
  const hdrCalculation = calculateHDR(animals, heatRecords, periodDays);
  
  // Calculate Breeding Season metrics (if enabled)
  const breedingSeason = enableSeasonalView 
    ? calculateBreedingSeason(aiRecords)
    : null;
  
  return {
    // SPC
    avgServicesPerConception: spcCalculation.avgSPC,
    spcByLivestockType: spcCalculation.byLivestock,
    repeatBreeders: spcCalculation.repeatBreeders,
    totalAIServices: spcCalculation.totalServices,
    totalConfirmedPregnancies: spcCalculation.confirmedPregnancies,
    
    // CI
    avgCalvingIntervalDays: ciCalculation.avgInterval,
    calvingIntervalDistribution: ciCalculation.distribution,
    longestIntervalAnimals: ciCalculation.longestAnimals,
    animalsWithIntervalData: ciCalculation.animalsWithData,
    
    // HDR
    heatDetectionRate: hdrCalculation.rate,
    expectedHeats: hdrCalculation.expected,
    detectedHeats: hdrCalculation.detected,
    avgCycleLengthDays: hdrCalculation.avgCycle,
    openCyclingCount: hdrCalculation.openCycling,
    detectionMethodBreakdown: hdrCalculation.methodBreakdown,
    
    // Season
    breedingSeason,
    
    // Meta
    periodDays,
    isLoading,
    error: null,
  };
}

// ============ Calculation Helpers ============

function calculateSPC(
  animals: any[],
  aiRecords: any[]
) {
  const femaleAnimals = animals.filter(a => 
    a.gender?.toLowerCase() === 'female'
  );
  
  // Total confirmed pregnancies from AI records
  const confirmedPregnancies = aiRecords.filter(r => r.pregnancy_confirmed === true).length;
  
  // Total AI services performed
  const totalServices = aiRecords.filter(r => r.performed_date).length;
  
  // Average SPC
  const avgSPC = confirmedPregnancies > 0 
    ? totalServices / confirmedPregnancies 
    : 0;
  
  // SPC by livestock type
  const byLivestock: Record<string, number> = {};
  const livestockTypes = [...new Set(femaleAnimals.map(a => a.livestock_type))];
  
  for (const type of livestockTypes) {
    const typeAnimalIds = femaleAnimals
      .filter(a => a.livestock_type === type)
      .map(a => a.id);
    
    const typeAI = aiRecords.filter(r => typeAnimalIds.includes(r.animal_id));
    const typeConfirmed = typeAI.filter(r => r.pregnancy_confirmed === true).length;
    const typeServices = typeAI.filter(r => r.performed_date).length;
    
    byLivestock[type] = typeConfirmed > 0 ? typeServices / typeConfirmed : 0;
  }
  
  // Repeat breeders (3+ services this cycle)
  const repeatBreeders: RepeatBreeder[] = femaleAnimals
    .filter(a => (a.services_this_cycle || 0) >= 3)
    .map(a => ({
      id: a.id,
      name: a.name,
      ear_tag: a.ear_tag,
      livestock_type: a.livestock_type,
      services_this_cycle: a.services_this_cycle || 0,
    }))
    .sort((a, b) => b.services_this_cycle - a.services_this_cycle);
  
  return {
    avgSPC,
    byLivestock,
    repeatBreeders,
    totalServices,
    confirmedPregnancies,
  };
}

function calculateCalvingInterval(
  animals: any[],
  calvingEvents: any[]
) {
  // Group calving events by animal
  const eventsByAnimal: Record<string, any[]> = {};
  for (const event of calvingEvents) {
    if (!eventsByAnimal[event.animal_id]) {
      eventsByAnimal[event.animal_id] = [];
    }
    eventsByAnimal[event.animal_id].push(event);
  }
  
  const intervals: { animal: any; interval: number }[] = [];
  
  // Calculate intervals for animals with 2+ calvings
  for (const animal of animals) {
    const events = eventsByAnimal[animal.id] || [];
    
    // Sort by date descending
    events.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    
    if (events.length >= 2) {
      // Calculate interval between most recent calvings
      const interval = differenceInDays(
        new Date(events[0].event_date),
        new Date(events[1].event_date)
      );
      
      if (interval > 0 && interval < 1000) { // Sanity check
        intervals.push({ animal, interval });
      }
    }
  }
  
  // Average interval
  const avgInterval = intervals.length > 0
    ? intervals.reduce((sum, i) => sum + i.interval, 0) / intervals.length
    : 0;
  
  // Distribution buckets
  const distribution: { range: string; count: number; livestock: string }[] = [];
  const ranges = [
    { min: 0, max: 365, label: '<365d' },
    { min: 365, max: 400, label: '365-400d' },
    { min: 400, max: 450, label: '400-450d' },
    { min: 450, max: 500, label: '450-500d' },
    { min: 500, max: Infinity, label: '>500d' },
  ];
  
  for (const range of ranges) {
    const count = intervals.filter(i => 
      i.interval >= range.min && i.interval < range.max
    ).length;
    
    distribution.push({
      range: range.label,
      count,
      livestock: 'all',
    });
  }
  
  // Longest interval animals
  const longestAnimals: CalvingIntervalAnimal[] = intervals
    .sort((a, b) => b.interval - a.interval)
    .slice(0, 5)
    .map(i => ({
      id: i.animal.id,
      name: i.animal.name,
      ear_tag: i.animal.ear_tag,
      livestock_type: i.animal.livestock_type,
      interval_days: i.interval,
      last_calving_date: i.animal.last_calving_date || '',
    }));
  
  return {
    avgInterval,
    distribution,
    longestAnimals,
    animalsWithData: intervals.length,
  };
}

function calculateHDR(
  animals: any[],
  heatRecords: any[],
  periodDays: number
) {
  // Count open cycling females
  const openCyclingStatuses = ['open_cycling', 'in_heat'];
  const openCycling = animals.filter(a => 
    a.gender?.toLowerCase() === 'female' &&
    openCyclingStatuses.includes(a.fertility_status)
  ).length;
  
  // Expected heats = open cycling × (period days / 21)
  const avgCycle = 21; // Default estrous cycle
  const expectedHeats = openCycling * (periodDays / avgCycle);
  
  // Detected heats from records
  const detectedHeats = heatRecords.length;
  
  // Heat Detection Rate
  const rate = expectedHeats > 0 
    ? Math.min(100, (detectedHeats / expectedHeats) * 100)
    : 0;
  
  // Detection method breakdown
  const methodBreakdown: Record<string, number> = {};
  for (const record of heatRecords) {
    const method = record.detection_method || 'unknown';
    methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
  }
  
  return {
    rate,
    expected: Math.round(expectedHeats),
    detected: detectedHeats,
    avgCycle,
    openCycling,
    methodBreakdown,
  };
}

function calculateBreedingSeason(aiRecords: any[]) {
  const now = new Date();
  const month = now.getMonth();
  
  // Define seasons (Philippines context: wet/dry)
  const isWetSeason = month >= 5 && month <= 10; // June-November
  const seasonName = isWetSeason ? 'Wet Season' : 'Dry Season';
  
  // Count AI in current season window
  const seasonStart = isWetSeason 
    ? new Date(now.getFullYear(), 5, 1) // June 1
    : new Date(now.getFullYear(), 11, 1); // December 1
  
  const seasonAI = aiRecords.filter(r => 
    r.performed_date && new Date(r.performed_date) >= seasonStart
  );
  
  const confirmed = seasonAI.filter(r => r.pregnancy_confirmed === true).length;
  const conceptionRate = seasonAI.length > 0 
    ? (confirmed / seasonAI.length) * 100
    : 0;
  
  return {
    isActive: true,
    seasonName,
    aiThisSeason: seasonAI.length,
    conceptionRate,
  };
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

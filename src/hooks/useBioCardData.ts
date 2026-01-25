/**
 * Unified Bio-Card Data Hook
 * 
 * Aggregates all animal performance data from existing SSOT hooks
 * to provide a complete picture for the Bio-Card visualization.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGrowthBenchmark, GrowthBenchmark } from './useGrowthBenchmark';
import { useBodyConditionScores, BodyConditionScore } from './useBodyConditionScores';
import { useHeatRecords, HeatRecord } from './useHeatRecords';
import { usePreventiveHealthSchedules } from './usePreventiveHealth';
import { useUpcomingAlerts, UpcomingAlert } from './useUpcomingAlerts';
import { 
  calculateOVRScore, 
  calculateStatusAura, 
  OVRResult, 
  OVRInputs,
  StatusAura 
} from '@/lib/ovrScoreCalculator';
import { differenceInDays } from 'date-fns';

export interface BioCardAnimalData {
  id: string;
  name: string | null;
  ear_tag: string | null;
  gender: string | null;
  life_stage: string | null;
  milking_stage: string | null;
  livestock_type: string;
  birth_date: string | null;
  avatar_url: string | null;
  current_weight_kg: number | null;
  farm_id: string;
  breed: string | null;
}

export interface RadarChartData {
  axis: string;
  axisTagalog: string;
  value: number;
  benchmark: number;
}

export interface SparklineData {
  date: string;
  value: number;
}

export interface ReproStatus {
  isPregnant: boolean;
  expectedDeliveryDate: string | null;
  daysSinceLastHeat: number | null;
  cycleDay: number | null;
  isInBreedingWindow: boolean;
  breedingWindowStart: string | null;
  breedingWindowEnd: string | null;
  lastHeatDate: string | null;
  averageCycleLength: number | null;
  daysToNextHeat: number | null;
}

export interface ImmunityStatus {
  level: 100 | 50 | 0;
  label: 'full' | 'booster_due' | 'overdue';
  overdueVaccines: string[];
  upcomingVaccines: Array<{ name: string; dueDate: string; daysUntil: number }>;
  compliancePercent: number;
  nextDueDate: string | null;
}

export interface LactationInfo {
  stage: string | null;
  daysInMilk: number | null;
  daysToNextPhase: number | null;
  progressPercent: number;
}

export interface BioCardData {
  // Core OVR
  ovr: OVRResult;
  statusAura: StatusAura;
  
  // Radar chart data (5-axis)
  radarData: RadarChartData[];
  
  // Trend sparklines
  weightSparkline: SparklineData[];
  bcsSparkline: SparklineData[];
  milkSparkline: SparklineData[];
  
  // Reproductive status
  reproStatus: ReproStatus;
  
  // Health/Immunity
  immunityStatus: ImmunityStatus;
  
  // Alerts (from existing hook)
  activeAlerts: UpcomingAlert[];
  
  // Market value
  estimatedValue: number | null;
  marketPricePerKg: number;
  priceSource: string;
  
  // Growth benchmark (from existing hook)
  growthBenchmark: GrowthBenchmark | null;
  
  // Latest BCS
  latestBCS: BodyConditionScore | null;
  
  // Lactation info (Phase 3)
  lactationInfo: LactationInfo | null;
  
  // Loading states
  isLoading: boolean;
}

export function useBioCardData(
  animal: BioCardAnimalData | null,
  farmId: string | undefined
): BioCardData {
  const animalId = animal?.id || '';
  
  // ========== EXISTING SSOT HOOKS ==========
  
  // Growth benchmark (ADG, weight status)
  const { benchmark: growthBenchmark } = useGrowthBenchmark(animalId, animal ? {
    birth_date: animal.birth_date,
    gender: animal.gender,
    life_stage: animal.life_stage,
    current_weight_kg: animal.current_weight_kg,
    livestock_type: animal.livestock_type,
  } : null);
  
  // Body Condition Scores
  const { 
    bcsRecords: bcsScores, 
    latestBCS,
    isLoading: bcsLoading 
  } = useBodyConditionScores(animalId);
  
  // Heat Records
  const { 
    heatRecords, 
    averageCycleLength,
    isLoading: heatLoading 
  } = useHeatRecords(animalId);
  
  // Preventive Health Schedules
  const { 
    data: healthSchedules = [], 
    isLoading: healthLoading 
  } = usePreventiveHealthSchedules(animalId, farmId);
  
  // Upcoming Alerts
  const { 
    data: alerts = [], 
    isLoading: alertsLoading 
  } = useUpcomingAlerts(farmId, 14);
  
  // ========== ADDITIONAL QUERIES ==========
  
  // Milking records for sparkline (last 30 days)
  const { data: milkingRecords = [], isLoading: milkLoading } = useQuery({
    queryKey: ['bio-card-milking', animalId],
    queryFn: async () => {
      if (!animalId) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('milking_records')
        .select('record_date, liters')
        .eq('animal_id', animalId)
        .gte('record_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('record_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!animalId && animal?.gender?.toLowerCase() === 'female',
    staleTime: 5 * 60 * 1000,
  });
  
  // Weight records for sparkline (last 6 months)
  const { data: weightRecords = [], isLoading: weightLoading } = useQuery({
    queryKey: ['bio-card-weight', animalId],
    queryFn: async () => {
      if (!animalId) return [];
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data, error } = await supabase
        .from('weight_records')
        .select('measurement_date, weight_kg')
        .eq('animal_id', animalId)
        .gte('measurement_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('measurement_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!animalId,
    staleTime: 5 * 60 * 1000,
  });
  
  // AI records for pregnancy status
  const { data: aiRecords = [], isLoading: aiLoading } = useQuery({
    queryKey: ['bio-card-ai', animalId],
    queryFn: async () => {
      if (!animalId) return [];
      
      const { data, error } = await supabase
        .from('ai_records')
        .select('performed_date, pregnancy_confirmed, expected_delivery_date')
        .eq('animal_id', animalId)
        .order('performed_date', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!animalId && animal?.gender?.toLowerCase() === 'female',
    staleTime: 5 * 60 * 1000,
  });
  
  // Market price
  const { data: marketPriceData } = useQuery({
    queryKey: ['bio-card-market-price', farmId, animal?.livestock_type],
    queryFn: async () => {
      if (!farmId || !animal?.livestock_type) return null;
      
      const { data, error } = await supabase.rpc('get_market_price', {
        p_livestock_type: animal.livestock_type,
        p_farm_id: farmId,
      });
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!farmId && !!animal?.livestock_type,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
  
  // ========== COMPUTED VALUES ==========
  
  const bioCardData = useMemo<BioCardData>(() => {
    const isLoading = bcsLoading || heatLoading || healthLoading || 
                      alertsLoading || milkLoading || weightLoading || aiLoading;
    
    // Default empty state
    if (!animal) {
      return getEmptyBioCardData(isLoading);
    }
    
    // ===== REPRODUCTIVE STATUS =====
    const latestHeat = heatRecords?.[0];
    const daysSinceLastHeat = latestHeat?.detected_at 
      ? differenceInDays(new Date(), new Date(latestHeat.detected_at))
      : null;
    const cycleDay = daysSinceLastHeat != null && daysSinceLastHeat <= 21 
      ? daysSinceLastHeat 
      : null;
    
    const latestPregnancy = aiRecords?.find(r => r.pregnancy_confirmed === true);
    const isPregnant = !!latestPregnancy?.pregnancy_confirmed;
    
    const isInBreedingWindow = latestHeat?.optimal_breeding_start && latestHeat?.optimal_breeding_end
      ? new Date() >= new Date(latestHeat.optimal_breeding_start) && 
        new Date() <= new Date(latestHeat.optimal_breeding_end)
      : false;
    
    // Calculate days to next heat based on average cycle length
    const daysToNextHeat = (daysSinceLastHeat != null && averageCycleLength != null)
      ? Math.max(0, averageCycleLength - daysSinceLastHeat)
      : null;

    const reproStatus: ReproStatus = {
      isPregnant,
      expectedDeliveryDate: latestPregnancy?.expected_delivery_date || null,
      daysSinceLastHeat,
      cycleDay,
      isInBreedingWindow,
      breedingWindowStart: latestHeat?.optimal_breeding_start || null,
      breedingWindowEnd: latestHeat?.optimal_breeding_end || null,
      lastHeatDate: latestHeat?.detected_at || null,
      averageCycleLength: averageCycleLength || null,
      daysToNextHeat,
    };
    
    // ===== IMMUNITY STATUS =====
    const scheduledVaccines = healthSchedules?.filter(s => s.status === 'scheduled') || [];
    const completedVaccines = healthSchedules?.filter(s => s.status === 'completed') || [];
    const overdueVaccines = scheduledVaccines
      .filter(s => new Date(s.scheduled_date) < new Date())
      .map(s => s.treatment_name);
    const upcomingVaccines = scheduledVaccines
      .filter(s => new Date(s.scheduled_date) >= new Date())
      .slice(0, 3)
      .map(s => ({
        name: s.treatment_name,
        dueDate: s.scheduled_date,
        daysUntil: differenceInDays(new Date(s.scheduled_date), new Date()),
      }));
    
    const totalScheduled = scheduledVaccines.length + completedVaccines.length;
    const compliancePercent = totalScheduled > 0 
      ? Math.round((completedVaccines.length / totalScheduled) * 100)
      : 100;
    
    let immunityLevel: ImmunityStatus['level'] = 100;
    let immunityLabel: ImmunityStatus['label'] = 'full';
    if (overdueVaccines.length > 0) {
      immunityLevel = 0;
      immunityLabel = 'overdue';
    } else if (upcomingVaccines.some(v => v.daysUntil <= 30)) {
      immunityLevel = 50;
      immunityLabel = 'booster_due';
    }
    
    const immunityStatus: ImmunityStatus = {
      level: immunityLevel,
      label: immunityLabel,
      overdueVaccines,
      upcomingVaccines,
      compliancePercent,
      nextDueDate: upcomingVaccines.length > 0 ? upcomingVaccines[0].dueDate : null,
    };
    
    // ===== SPARKLINES =====
    const weightSparkline: SparklineData[] = weightRecords.map(w => ({
      date: w.measurement_date,
      value: Number(w.weight_kg),
    }));
    
    const bcsSparkline: SparklineData[] = (bcsScores || []).slice(0, 10).reverse().map(b => ({
      date: b.assessment_date,
      value: Number(b.score),
    }));
    
    // Aggregate milk by date
    const milkByDate = new Map<string, number>();
    milkingRecords.forEach(m => {
      const existing = milkByDate.get(m.record_date) || 0;
      milkByDate.set(m.record_date, existing + Number(m.liters));
    });
    const milkSparkline: SparklineData[] = Array.from(milkByDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // ===== MARKET VALUE =====
    const marketPrice = marketPriceData?.price || 300;
    const priceSource = marketPriceData?.source || 'system_default';
    const estimatedValue = animal.current_weight_kg 
      ? Math.round(animal.current_weight_kg * marketPrice)
      : null;
    
    // ===== OVR CALCULATION =====
    const avgDailyMilk = milkSparkline.length > 0
      ? milkSparkline.reduce((sum, m) => sum + m.value, 0) / milkSparkline.length
      : null;
    
    const isMilking = animal.milking_stage != null && 
      !['dry', 'Dry'].includes(animal.milking_stage);
    
    const ovrInputs: OVRInputs = {
      avgDailyMilk,
      milkBenchmark: 8, // Typical Philippine dairy benchmark
      adgGrams: growthBenchmark?.adgActual || null,
      adgBenchmark: growthBenchmark?.adgExpected || 500,
      vaccinationCompliance: compliancePercent,
      hasActiveHealthIssues: false, // Would need health_records query
      hasWithdrawalPeriod: false,   // Would need injection_records check
      overdueVaccineCount: overdueVaccines.length,
      isPregnant,
      calvingIntervalDays: null, // Would calculate from offspring data
      heatCycleRegularity: averageCycleLength 
        ? (averageCycleLength >= 18 && averageCycleLength <= 24 ? 90 : 60)
        : undefined,
      adgPercentOfExpected: growthBenchmark?.adgPercentOfExpected || null,
      weightStatus: growthBenchmark?.status || null,
      latestBCS: latestBCS?.score ? Number(latestBCS.score) : null,
      bcsOptimalMin: 2.5,
      bcsOptimalMax: 4.0,
      livestockType: animal.livestock_type,
      lifeStage: animal.life_stage,
      gender: animal.gender,
      isMilking,
    };
    
    const ovr = calculateOVRScore(ovrInputs);
    
    // ===== STATUS AURA =====
    const statusAura = calculateStatusAura({
      hasActiveWithdrawal: false,
      isQuarantined: false,
      hasOverdueVaccine: overdueVaccines.length > 0,
      isBCSCritical: latestBCS?.score ? (Number(latestBCS.score) < 2 || Number(latestBCS.score) > 4.5) : false,
      isInHeatWindow: isInBreedingWindow,
      hasActiveHealthIssue: false,
    });
    
    // ===== RADAR CHART DATA =====
    const radarData: RadarChartData[] = [
      { axis: 'Production', axisTagalog: 'Produksyon', value: ovr.breakdown.production, benchmark: 75 },
      { axis: 'Health', axisTagalog: 'Kalusugan', value: ovr.breakdown.health, benchmark: 85 },
      { axis: 'Fertility', axisTagalog: 'Pagpaparami', value: ovr.breakdown.fertility, benchmark: 70 },
      { axis: 'Growth', axisTagalog: 'Paglaki', value: ovr.breakdown.growth, benchmark: 75 },
      { axis: 'Body Condition', axisTagalog: 'Kondisyon', value: ovr.breakdown.bodyCondition, benchmark: 80 },
    ];
    
    // ===== FILTER ALERTS FOR THIS ANIMAL =====
    const activeAlerts = alerts.filter(a => a.animal_id === animalId);
    
    // ===== LACTATION INFO =====
    const lactationInfo: LactationInfo | null = animal.milking_stage ? (() => {
      const stage = animal.milking_stage;
      const daysInMilk = animal.current_weight_kg ? null : null; // Would need milking_start_date
      
      // Calculate progress based on stage (estimate)
      const stageProgress: Record<string, number> = {
        'Early Lactation': 20,
        'early': 20,
        'Peak Lactation': 30,
        'peak': 30,
        'Mid Lactation': 50,
        'mid': 50,
        'Late Lactation': 75,
        'late': 75,
        'Dry': 95,
        'dry': 95,
      };
      
      return {
        stage,
        daysInMilk: null, // Would calculate from milking_start_date
        daysToNextPhase: null,
        progressPercent: stageProgress[stage] || 0,
      };
    })() : null;
    
    return {
      ovr,
      statusAura,
      radarData,
      weightSparkline,
      bcsSparkline,
      milkSparkline,
      reproStatus,
      immunityStatus,
      activeAlerts,
      estimatedValue,
      marketPricePerKg: marketPrice,
      priceSource,
      growthBenchmark,
      latestBCS,
      lactationInfo,
      isLoading,
    };
  }, [
    animal, 
    growthBenchmark, 
    bcsScores, 
    latestBCS,
    heatRecords, 
    averageCycleLength,
    healthSchedules, 
    alerts, 
    milkingRecords, 
    weightRecords, 
    aiRecords,
    marketPriceData,
    bcsLoading, 
    heatLoading, 
    healthLoading, 
    alertsLoading, 
    milkLoading, 
    weightLoading, 
    aiLoading,
  ]);
  
  return bioCardData;
}

/**
 * Empty state for Bio-Card data
 */
function getEmptyBioCardData(isLoading: boolean): BioCardData {
  return {
    ovr: {
      score: 0,
      tier: 'bronze',
      breakdown: { production: 0, health: 0, fertility: 0, growth: 0, bodyCondition: 0 },
      trend: 'stable',
    },
    statusAura: 'green',
    radarData: [],
    weightSparkline: [],
    bcsSparkline: [],
    milkSparkline: [],
    reproStatus: {
      isPregnant: false,
      expectedDeliveryDate: null,
      daysSinceLastHeat: null,
      cycleDay: null,
      isInBreedingWindow: false,
      breedingWindowStart: null,
      breedingWindowEnd: null,
      lastHeatDate: null,
      averageCycleLength: null,
      daysToNextHeat: null,
    },
    immunityStatus: {
      level: 100,
      label: 'full',
      overdueVaccines: [],
      upcomingVaccines: [],
      compliancePercent: 100,
      nextDueDate: null,
    },
    activeAlerts: [],
    estimatedValue: null,
    marketPricePerKg: 300,
    priceSource: 'system_default',
    growthBenchmark: null,
    latestBCS: null,
    lactationInfo: null,
    isLoading,
  };
}

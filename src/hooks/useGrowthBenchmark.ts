import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWeightRange, estimateWeightByAge } from '@/lib/weightEstimates';
import { calculateOverallADG, getExpectedADG, getADGStatus } from '@/lib/growthMetrics';

export interface GrowthBenchmark {
  status: 'on_track' | 'below' | 'above' | 'critical';
  percentOfExpected: number;
  currentWeight: number;
  expectedWeight: number;
  expectedRange: { min: number; max: number } | null;
  monthlyGainActual: number | null;
  monthlyGainExpected: number | null;
  recommendation: string;
  recommendationTagalog: string;
  // ADG fields
  adgActual: number | null;
  adgExpected: number | null;
  adgStatus: 'excellent' | 'good' | 'fair' | 'poor' | null;
  adgPercentOfExpected: number | null;
}

interface AnimalData {
  birth_date: string | null;
  gender: string | null;
  life_stage: string | null;
  current_weight_kg: number | null;
  livestock_type: string;
}

export function useGrowthBenchmark(animalId: string, animalData: AnimalData | null) {
  // Fetch weight history for growth rate calculation
  const { data: weightRecords = [] } = useQuery({
    queryKey: ['weight-records-benchmark', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weight_records')
        .select('weight_kg, measurement_date')
        .eq('animal_id', animalId)
        .order('measurement_date', { ascending: true })
        .limit(12);

      if (error) throw error;
      return data;
    },
    enabled: !!animalId,
  });

  const benchmark = useMemo<GrowthBenchmark | null>(() => {
    if (!animalData?.birth_date || !animalData?.current_weight_kg) {
      return null;
    }

    const birthDate = new Date(animalData.birth_date);
    const gender = animalData.gender || 'female';
    const lifeStage = animalData.life_stage || null;
    const livestockType = animalData.livestock_type || 'cattle';
    const currentWeight = animalData.current_weight_kg;

    // Get expected weight based on age
    const expectedWeight = estimateWeightByAge({
      birthDate,
      gender,
      lifeStage,
      livestockType,
    });

    // Get expected range for life stage
    const expectedRange = getWeightRange(lifeStage, gender, livestockType);

    // Calculate percent of expected
    const percentOfExpected = expectedWeight > 0 
      ? Math.round((currentWeight / expectedWeight) * 100) 
      : 100;

    // Calculate actual monthly gain from weight records
    let monthlyGainActual: number | null = null;
    if (weightRecords.length >= 2) {
      const oldest = weightRecords[0];
      const newest = weightRecords[weightRecords.length - 1];
      const monthsDiff = (
        new Date(newest.measurement_date).getTime() - 
        new Date(oldest.measurement_date).getTime()
      ) / (1000 * 60 * 60 * 24 * 30);
      
      if (monthsDiff > 0) {
        monthlyGainActual = Math.round((newest.weight_kg - oldest.weight_kg) / monthsDiff * 10) / 10;
      }
    }

    // Expected monthly gain from weight range data
    const monthlyGainExpected = expectedRange?.avgMonthlyGrowth || null;

    // Calculate ADG from weight records
    let adgActual: number | null = null;
    let adgExpected: number | null = null;
    let adgStatus: GrowthBenchmark['adgStatus'] = null;
    let adgPercentOfExpected: number | null = null;

    if (weightRecords.length >= 2) {
      const adgResult = calculateOverallADG(
        weightRecords.map(r => ({ weight_kg: r.weight_kg, measurement_date: r.measurement_date })),
        livestockType,
        gender,
        lifeStage
      );
      
      if (adgResult) {
        adgActual = adgResult.adgGrams;
        adgStatus = adgResult.status;
        adgPercentOfExpected = adgResult.percentOfExpected;
      }
    }

    // Get expected ADG for life stage
    const expectedADGData = getExpectedADG(livestockType, gender, lifeStage);
    if (expectedADGData) {
      adgExpected = expectedADGData.optimal;
    }

    // Determine status
    let status: GrowthBenchmark['status'];
    let recommendation: string;
    let recommendationTagalog: string;

    if (percentOfExpected < 70) {
      status = 'critical';
      recommendation = 'Significantly underweight. Consult a veterinarian and increase feed quality/quantity.';
      recommendationTagalog = 'Lubhang kulang sa timbang. Kumonsulta sa beterinaryo at dagdagan ang kalidad/dami ng pagkain.';
    } else if (percentOfExpected < 85) {
      status = 'below';
      recommendation = 'Below expected weight. Consider supplemental feeding.';
      recommendationTagalog = 'Kulang sa inaasahang timbang. Subukan ang dagdag na pakain.';
    } else if (percentOfExpected > 120) {
      status = 'above';
      recommendation = 'Above expected weight. May indicate good genetics or overfeeding.';
      recommendationTagalog = 'Higit sa inaasahang timbang. Maaaring magandang lahi o labis na pagpapakain.';
    } else {
      status = 'on_track';
      recommendation = 'Weight is on track for age and life stage.';
      recommendationTagalog = 'Ang timbang ay nasa tamang landas para sa edad.';
    }

    return {
      status,
      percentOfExpected,
      currentWeight,
      expectedWeight,
      expectedRange: expectedRange ? { min: expectedRange.min, max: expectedRange.max } : null,
      monthlyGainActual,
      monthlyGainExpected,
      recommendation,
      recommendationTagalog,
      adgActual,
      adgExpected,
      adgStatus,
      adgPercentOfExpected,
    };
  }, [animalData, weightRecords]);

  return { benchmark };
}

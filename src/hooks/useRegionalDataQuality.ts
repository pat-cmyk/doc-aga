import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataCategory } from "@/types/government";

export interface RegionalDataQualityData {
  region: string;
  province: string;
  total_farms: number;
  farms_with_gps: number;
  gps_coverage_pct: number;
  total_animals: number;
  animals_with_weight: number;
  weight_completeness_pct: number;
  farms_with_production_logs: number;
  production_tracking_pct: number;
  farms_with_health_logs: number;
  health_recording_pct: number;
  overall_quality_score: number;
}

export interface DataQualitySummary {
  totalFarms: number;
  totalAnimals: number;
  overallGpsCoverage: number;
  overallWeightCompleteness: number;
  overallProductionTracking: number;
  overallHealthRecording: number;
  overallQualityScore: number;
  regions: RegionalDataQualityData[];
  regionsNeedingAttention: RegionalDataQualityData[];
}

export const useRegionalDataQuality = (
  region?: string,
  province?: string,
  municipality?: string,
  dataCategory: DataCategory = 'live',
  options?: { enabled?: boolean }
) => {
  return useQuery<DataQualitySummary>({
    queryKey: ["regional-data-quality", region || "all", province || "all", municipality || "all", dataCategory],
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log('[DataQuality] Fetching regional data quality metrics...');
      
      const { data, error } = await supabase.rpc("get_regional_data_quality", {
        region_filter: region || null,
        province_filter: province || null,
        municipality_filter: municipality || null,
        data_category_filter: dataCategory === 'all' ? null : dataCategory,
      });

      if (error) {
        console.error('[DataQuality] Error fetching data quality:', error);
        throw error;
      }

      const regions: RegionalDataQualityData[] = (data || []).map((row: any) => ({
        region: row.region,
        province: row.province,
        total_farms: Number(row.total_farms) || 0,
        farms_with_gps: Number(row.farms_with_gps) || 0,
        gps_coverage_pct: Number(row.gps_coverage_pct) || 0,
        total_animals: Number(row.total_animals) || 0,
        animals_with_weight: Number(row.animals_with_weight) || 0,
        weight_completeness_pct: Number(row.weight_completeness_pct) || 0,
        farms_with_production_logs: Number(row.farms_with_production_logs) || 0,
        production_tracking_pct: Number(row.production_tracking_pct) || 0,
        farms_with_health_logs: Number(row.farms_with_health_logs) || 0,
        health_recording_pct: Number(row.health_recording_pct) || 0,
        overall_quality_score: Number(row.overall_quality_score) || 0,
      }));

      // Calculate totals
      const totalFarms = regions.reduce((sum, r) => sum + r.total_farms, 0);
      const totalAnimals = regions.reduce((sum, r) => sum + r.total_animals, 0);
      
      // Weighted averages for overall metrics
      const totalFarmsWithGps = regions.reduce((sum, r) => sum + r.farms_with_gps, 0);
      const totalAnimalsWithWeight = regions.reduce((sum, r) => sum + r.animals_with_weight, 0);
      const totalFarmsWithProduction = regions.reduce((sum, r) => sum + r.farms_with_production_logs, 0);
      const totalFarmsWithHealth = regions.reduce((sum, r) => sum + r.farms_with_health_logs, 0);

      const overallGpsCoverage = totalFarms > 0 ? (totalFarmsWithGps / totalFarms) * 100 : 0;
      const overallWeightCompleteness = totalAnimals > 0 ? (totalAnimalsWithWeight / totalAnimals) * 100 : 100;
      const overallProductionTracking = totalFarms > 0 ? (totalFarmsWithProduction / totalFarms) * 100 : 0;
      const overallHealthRecording = totalFarms > 0 ? (totalFarmsWithHealth / totalFarms) * 100 : 0;

      // Overall quality score (weighted average)
      const overallQualityScore = (overallGpsCoverage * 0.25 + overallWeightCompleteness * 0.25 + 
        overallProductionTracking * 0.25 + overallHealthRecording * 0.25);

      // Regions needing attention (quality score < 50)
      const regionsNeedingAttention = regions.filter(r => r.overall_quality_score < 50);

      console.log(`[DataQuality] Found ${regions.length} regions, ${regionsNeedingAttention.length} needing attention`);

      return {
        totalFarms,
        totalAnimals,
        overallGpsCoverage: Math.round(overallGpsCoverage * 10) / 10,
        overallWeightCompleteness: Math.round(overallWeightCompleteness * 10) / 10,
        overallProductionTracking: Math.round(overallProductionTracking * 10) / 10,
        overallHealthRecording: Math.round(overallHealthRecording * 10) / 10,
        overallQualityScore: Math.round(overallQualityScore * 10) / 10,
        regions,
        regionsNeedingAttention,
      };
    },
  });
};

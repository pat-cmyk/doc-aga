import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRegionalCoordinates } from "@/lib/regionalCoordinates";

export type DataCategory = 'live' | 'demo' | 'all';

export interface RegionalStats {
  region: string;
  farm_count: number;
  animal_count: number;
  active_animal_count: number;
  avg_gps_lat: number;
  avg_gps_lng: number;
}

interface GovFarmAnalyticsRow {
  id: string;
  name: string;
  region: string;
  province: string;
  municipality: string;
  gps_lat: number | null;
  gps_lng: number | null;
  livestock_type: string | null;
  created_at: string;
  is_deleted: boolean;
  is_program_participant: boolean | null;
  program_group: string | null;
  data_category: string;
  active_animal_count: number;
  cattle_count: number;
  goat_count: number;
  carabao_count: number;
  sheep_count: number;
}

// Helper to safely parse numeric values (handles strings from Supabase)
const toNum = (value: unknown): number | null => {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const useRegionalStats = (dataCategory: DataCategory = 'live') => {
  return useQuery({
    queryKey: ["regional-stats", dataCategory],
    queryFn: async () => {
      // Use the audited RPC function for government analytics access
      const { data, error } = await supabase.rpc("get_gov_farm_analytics_with_audit", {
        _access_type: "view",
        _metadata: { source: "regional_stats_dashboard", data_category: dataCategory }
      });

      if (error) {
        console.error("[useRegionalStats] RPC error:", error.message);
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.warn("[useRegionalStats] No data returned from RPC");
        return [];
      }

      // Cast the data to our expected type
      const allFarms = data as unknown as GovFarmAnalyticsRow[];
      
      // Filter by data category client-side (view includes data_category column)
      const farms = dataCategory === 'all' 
        ? allFarms 
        : allFarms.filter(f => f.data_category === dataCategory);

      // Aggregate by region
      const regionMap = new Map<string, {
        farmCount: number;
        animalCount: number;
        activeAnimalCount: number;
        latSum: number;
        lngSum: number;
        coordCount: number;
      }>();

      farms.forEach((farm) => {
        const region = farm.region || "Unknown";
        const existing = regionMap.get(region) || {
          farmCount: 0,
          animalCount: 0,
          activeAnimalCount: 0,
          latSum: 0,
          lngSum: 0,
          coordCount: 0,
        };

        existing.farmCount += 1;
        
        // Calculate total animal count from species counts (with safe numeric parsing)
        const cattleCount = toNum(farm.cattle_count) ?? 0;
        const goatCount = toNum(farm.goat_count) ?? 0;
        const carabaoCount = toNum(farm.carabao_count) ?? 0;
        const sheepCount = toNum(farm.sheep_count) ?? 0;
        const totalAnimals = cattleCount + goatCount + carabaoCount + sheepCount;
        
        existing.animalCount += totalAnimals;
        existing.activeAnimalCount += toNum(farm.active_animal_count) ?? 0;

        // Parse GPS coordinates safely
        const lat = toNum(farm.gps_lat);
        const lng = toNum(farm.gps_lng);
        
        if (lat !== null && lng !== null) {
          existing.latSum += lat;
          existing.lngSum += lng;
          existing.coordCount += 1;
        }

        regionMap.set(region, existing);
      });

      // Convert to array with calculated averages
      const stats: RegionalStats[] = [];
      regionMap.forEach((data, region) => {
        // Use actual coordinates if available, otherwise fallback to predefined
        const fallbackCoords = getRegionalCoordinates(region);
        
        let avg_gps_lat: number;
        let avg_gps_lng: number;
        
        if (data.coordCount > 0) {
          avg_gps_lat = data.latSum / data.coordCount;
          avg_gps_lng = data.lngSum / data.coordCount;
        } else if (fallbackCoords) {
          avg_gps_lat = fallbackCoords.lat;
          avg_gps_lng = fallbackCoords.lng;
        } else {
          // Default to center of Philippines if no coordinates available
          avg_gps_lat = 12.8797;
          avg_gps_lng = 121.7740;
        }

        stats.push({
          region,
          farm_count: data.farmCount,
          animal_count: data.animalCount,
          active_animal_count: data.activeAnimalCount,
          avg_gps_lat,
          avg_gps_lng,
        });
      });

      console.log(`[useRegionalStats] Returning ${stats.length} regions for category "${dataCategory}":`, 
        stats.map(s => `${s.region} (${s.farm_count} farms)`).join(', '));

      return stats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

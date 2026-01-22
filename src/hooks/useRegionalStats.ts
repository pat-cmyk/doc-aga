import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRegionalCoordinates } from "@/lib/regionalCoordinates";

export interface RegionalStats {
  region: string;
  farm_count: number;
  animal_count: number;
  active_animal_count: number;
  health_events_7d: number;
  health_events_30d: number;
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
  lgu_code: string | null;
  ffedis_id: string | null;
  validation_status: string | null;
  validated_at: string | null;
  is_program_participant: boolean | null;
  program_group: string | null;
  animal_count: number;
  active_animal_count: number;
  health_events_7d: number;
  health_events_30d: number;
}

export const useRegionalStats = () => {
  return useQuery({
    queryKey: ["regional-stats"],
    queryFn: async () => {
      // Use the audited RPC function for government analytics access
      const { data, error } = await supabase.rpc("get_gov_farm_analytics_with_audit", {
        _access_type: "view",
        _metadata: { source: "regional_stats_dashboard" }
      });

      if (error) throw error;

      // Cast the data to our expected type
      const farms = data as unknown as GovFarmAnalyticsRow[];

      // Aggregate by region
      const regionMap = new Map<string, {
        farmCount: number;
        animalCount: number;
        activeAnimalCount: number;
        healthEvents7d: number;
        healthEvents30d: number;
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
          healthEvents7d: 0,
          healthEvents30d: 0,
          latSum: 0,
          lngSum: 0,
          coordCount: 0,
        };

        existing.farmCount += 1;
        existing.animalCount += farm.animal_count || 0;
        existing.activeAnimalCount += farm.active_animal_count || 0;
        existing.healthEvents7d += farm.health_events_7d || 0;
        existing.healthEvents30d += farm.health_events_30d || 0;

        if (farm.gps_lat && farm.gps_lng) {
          existing.latSum += farm.gps_lat;
          existing.lngSum += farm.gps_lng;
          existing.coordCount += 1;
        }

        regionMap.set(region, existing);
      });

      // Convert to array with calculated averages
      const stats: RegionalStats[] = [];
      regionMap.forEach((data, region) => {
        // Use actual coordinates if available, otherwise fallback to predefined
        const fallbackCoords = getRegionalCoordinates(region);
        const avg_gps_lat = data.coordCount > 0 ? data.latSum / data.coordCount : (fallbackCoords?.lat ?? 12.8797);
        const avg_gps_lng = data.coordCount > 0 ? data.lngSum / data.coordCount : (fallbackCoords?.lng ?? 121.7740);

        stats.push({
          region,
          farm_count: data.farmCount,
          animal_count: data.animalCount,
          active_animal_count: data.activeAnimalCount,
          health_events_7d: data.healthEvents7d,
          health_events_30d: data.healthEvents30d,
          avg_gps_lat,
          avg_gps_lng,
        });
      });

      return stats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

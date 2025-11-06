import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRegionalCoordinates } from "@/lib/regionalCoordinates";

interface RegionalStats {
  region: string;
  farm_count: number;
  active_animal_count: number;
  health_events_7d: number;
  avg_gps_lat: number;
  avg_gps_lng: number;
}

export const useRegionalStats = () => {
  return useQuery({
    queryKey: ["regional-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gov_farm_analytics")
        .select("*");

      if (error) throw error;

      // Group by region and calculate stats with resilient coordinate handling
      type InternalRegion = RegionalStats & { latSum: number; lngSum: number; coordCount: number };
      const regionMap = new Map<string, InternalRegion>();

      data?.forEach((farm) => {
        if (!farm.region) return;

        const key = String(farm.region);
        const existing = regionMap.get(key) || {
          region: key,
          farm_count: 0,
          active_animal_count: 0,
          health_events_7d: 0,
          avg_gps_lat: 0,
          avg_gps_lng: 0,
          latSum: 0,
          lngSum: 0,
          coordCount: 0,
        };

        existing.farm_count += 1;
        existing.active_animal_count += Number(farm.active_animal_count || 0);
        existing.health_events_7d += Number(farm.health_events_7d || 0);

        const lat = Number(farm.gps_lat || 0);
        const lng = Number(farm.gps_lng || 0);
        if (lat !== 0 && lng !== 0) {
          existing.latSum += lat;
          existing.lngSum += lng;
          existing.coordCount += 1;
        }

        regionMap.set(key, existing);
      });

      const result: RegionalStats[] = Array.from(regionMap.values()).map((r) => {
        const hasAvg = r.coordCount > 0;
        const avgLat = hasAvg ? r.latSum / r.coordCount : 0;
        const avgLng = hasAvg ? r.lngSum / r.coordCount : 0;

        if (hasAvg && avgLat !== 0 && avgLng !== 0) {
          return { region: r.region, farm_count: r.farm_count, active_animal_count: r.active_animal_count, health_events_7d: r.health_events_7d, avg_gps_lat: avgLat, avg_gps_lng: avgLng };
        }

        const fallback = getRegionalCoordinates(r.region);
        return {
          region: r.region,
          farm_count: r.farm_count,
          active_animal_count: r.active_animal_count,
          health_events_7d: r.health_events_7d,
          avg_gps_lat: fallback?.lat ?? 0,
          avg_gps_lng: fallback?.lng ?? 0,
        };
      });

      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

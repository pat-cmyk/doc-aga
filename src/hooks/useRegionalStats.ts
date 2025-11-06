import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

      // Group by region and calculate stats
      const regionMap = new Map<string, RegionalStats>();

      data?.forEach((farm) => {
        if (!farm.region) return;

        const existing = regionMap.get(farm.region);
        if (existing) {
          existing.farm_count += 1;
          existing.active_animal_count += farm.active_animal_count || 0;
          existing.health_events_7d += farm.health_events_7d || 0;
          // Average GPS coordinates
          existing.avg_gps_lat = (existing.avg_gps_lat + (farm.gps_lat || 0)) / 2;
          existing.avg_gps_lng = (existing.avg_gps_lng + (farm.gps_lng || 0)) / 2;
        } else {
          regionMap.set(farm.region, {
            region: farm.region,
            farm_count: 1,
            active_animal_count: farm.active_animal_count || 0,
            health_events_7d: farm.health_events_7d || 0,
            avg_gps_lat: farm.gps_lat || 0,
            avg_gps_lng: farm.gps_lng || 0,
          });
        }
      });

      return Array.from(regionMap.values());
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

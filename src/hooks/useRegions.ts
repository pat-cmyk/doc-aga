import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useRegions = () => {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("region")
        .not("region", "is", null)
        .neq("region", "")
        .order("region");

      if (error) throw error;

      // Get unique regions
      const uniqueRegions = Array.from(new Set(data.map((farm) => farm.region)));
      return uniqueRegions.filter((region): region is string => region !== null);
    },
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });
};

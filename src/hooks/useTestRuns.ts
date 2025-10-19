import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTestRuns = () => {
  return useQuery({
    queryKey: ["test-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("run_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });
};

export const useLatestTestRun = () => {
  return useQuery({
    queryKey: ["latest-test-run"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_runs")
        .select("*")
        .order("run_date", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });
};

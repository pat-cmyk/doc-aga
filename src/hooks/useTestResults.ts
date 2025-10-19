import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTestResults = (testRunId?: string, statusFilter?: string, searchQuery?: string) => {
  return useQuery({
    queryKey: ["test-results", testRunId, statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("test_results")
        .select("*, test_runs(branch, run_date)")
        .order("created_at", { ascending: false });

      if (testRunId) {
        query = query.eq("test_run_id", testRunId);
      }

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchQuery) {
        query = query.or(`test_name.ilike.%${searchQuery}%,suite_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data;
    },
    enabled: true,
  });
};

export const useTestSuites = (testRunId?: string) => {
  return useQuery({
    queryKey: ["test-suites", testRunId],
    queryFn: async () => {
      let query = supabase
        .from("test_results")
        .select("suite_name, status, test_run_id");

      if (testRunId) {
        query = query.eq("test_run_id", testRunId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by suite
      const suites = data.reduce((acc: any, result: any) => {
        if (!acc[result.suite_name]) {
          acc[result.suite_name] = {
            name: result.suite_name,
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0,
          };
        }
        acc[result.suite_name].total++;
        if (result.status === "passed") acc[result.suite_name].passed++;
        if (result.status === "failed") acc[result.suite_name].failed++;
        if (result.status === "skipped") acc[result.suite_name].skipped++;
        return acc;
      }, {});

      return Object.values(suites);
    },
  });
};

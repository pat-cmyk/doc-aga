import { useQuery } from "@tanstack/react-query";
import { generateFinancialReport, FinancialCapacityReport } from "@/lib/financialReportGenerator";

export function useFinancialReport(farmId: string, periodMonths: number = 6) {
  return useQuery<FinancialCapacityReport>({
    queryKey: ["financial-report", farmId, periodMonths],
    queryFn: () => generateFinancialReport(farmId, periodMonths),
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

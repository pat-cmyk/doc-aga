import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLastMilkPriceBySpecies } from "./useRevenues";
import { MILK_REJECTION_REASONS } from "@/constants/milkQuality";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";

export interface RejectionReasonBreakdown {
  reason: string;
  label: string;
  count: number;
  liters: number;
  percentage: number;
}

export interface TopRejectedAnimal {
  animalId: string;
  animalName: string;
  rejectionCount: number;
  litersLost: number;
}

export interface MilkSpoilageData {
  totalLiters: number;
  rejectedLiters: number;
  rejectionRate: number;
  lostRevenue: number;
  reasonBreakdown: RejectionReasonBreakdown[];
  topRejectedAnimals: TopRejectedAnimal[];
  previousRejectionRate: number;
  status: 'excellent' | 'attention' | 'critical';
}

export function useMilkSpoilageReport(farmId: string, dateRange?: DateRange) {
  const { data: priceMap } = useLastMilkPriceBySpecies(farmId);

  // Compute previous period for trend comparison
  const periods = useMemo(() => {
    if (!dateRange) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        currentStart: start.toISOString().split('T')[0],
        currentEnd: end.toISOString().split('T')[0],
        prevStart: prevStart.toISOString().split('T')[0],
        prevEnd: prevEnd.toISOString().split('T')[0],
      };
    }
    const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
    const prevEnd = new Date(dateRange.start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return {
      currentStart: dateRange.start.toISOString().split('T')[0],
      currentEnd: dateRange.end.toISOString().split('T')[0],
      prevStart: prevStart.toISOString().split('T')[0],
      prevEnd: prevEnd.toISOString().split('T')[0],
    };
  }, [dateRange?.start?.getTime(), dateRange?.end?.getTime()]);

  return useQuery({
    queryKey: ["milk-spoilage-report", farmId, periods.currentStart, periods.currentEnd],
    queryFn: async () => {
      // Fetch current period records
      const { data: currentRecords, error: currentErr } = await supabase
        .from("milking_records")
        .select("id, liters, milk_quality, milk_quality_rejection_reason, animal_id, animals!inner(farm_id, name, livestock_type)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", periods.currentStart)
        .lte("record_date", periods.currentEnd);

      if (currentErr) throw currentErr;

      // Fetch previous period for trend
      const { data: prevRecords, error: prevErr } = await supabase
        .from("milking_records")
        .select("id, liters, milk_quality, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", periods.prevStart)
        .lte("record_date", periods.prevEnd);

      if (prevErr) throw prevErr;

      const records = currentRecords || [];
      const totalLiters = records.reduce((sum, r) => sum + (r.liters || 0), 0);
      const rejected = records.filter(r => r.milk_quality === 'rejected');
      const rejectedLiters = rejected.reduce((sum, r) => sum + (r.liters || 0), 0);
      const rejectionRate = totalLiters > 0 ? (rejectedLiters / totalLiters) * 100 : 0;

      // Lost revenue calc using species-specific prices
      let lostRevenue = 0;
      if (priceMap) {
        for (const r of rejected) {
          const species = (r.animals as any)?.livestock_type || 'cattle';
          const price = priceMap[species] ?? 30;
          lostRevenue += (r.liters || 0) * price;
        }
      }

      // Reason breakdown
      const reasonMap = new Map<string, { count: number; liters: number }>();
      for (const r of rejected) {
        const reason = r.milk_quality_rejection_reason || 'none';
        const existing = reasonMap.get(reason) || { count: 0, liters: 0 };
        existing.count += 1;
        existing.liters += r.liters || 0;
        reasonMap.set(reason, existing);
      }

      const reasonBreakdown: RejectionReasonBreakdown[] = Array.from(reasonMap.entries())
        .map(([reason, data]) => {
          const constant = MILK_REJECTION_REASONS.find(r => r.value === reason);
          return {
            reason,
            label: constant?.label || reason,
            count: data.count,
            liters: data.liters,
            percentage: rejectedLiters > 0 ? (data.liters / rejectedLiters) * 100 : 0,
          };
        })
        .sort((a, b) => b.liters - a.liters);

      // Top rejected animals
      const animalMap = new Map<string, { name: string; count: number; liters: number }>();
      for (const r of rejected) {
        const id = r.animal_id;
        const name = (r.animals as any)?.name || 'Unknown';
        const existing = animalMap.get(id) || { name, count: 0, liters: 0 };
        existing.count += 1;
        existing.liters += r.liters || 0;
        animalMap.set(id, existing);
      }

      const topRejectedAnimals: TopRejectedAnimal[] = Array.from(animalMap.entries())
        .map(([animalId, data]) => ({
          animalId,
          animalName: data.name,
          rejectionCount: data.count,
          litersLost: data.liters,
        }))
        .sort((a, b) => b.litersLost - a.litersLost)
        .slice(0, 5);

      // Previous period rate
      const prevTotal = (prevRecords || []).reduce((sum, r) => sum + (r.liters || 0), 0);
      const prevRejected = (prevRecords || []).filter(r => r.milk_quality === 'rejected').reduce((sum, r) => sum + (r.liters || 0), 0);
      const previousRejectionRate = prevTotal > 0 ? (prevRejected / prevTotal) * 100 : 0;

      // Status
      let status: 'excellent' | 'attention' | 'critical' = 'excellent';
      if (rejectionRate > 5) status = 'critical';
      else if (rejectionRate > 2) status = 'attention';

      return {
        totalLiters,
        rejectedLiters,
        rejectionRate,
        lostRevenue,
        reasonBreakdown,
        topRejectedAnimals,
        previousRejectionRate,
        status,
      } as MilkSpoilageData;
    },
    enabled: !!farmId && !!priceMap,
  });
}

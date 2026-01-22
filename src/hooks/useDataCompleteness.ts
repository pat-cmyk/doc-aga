import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format } from "date-fns";

export interface DataCompletenessItem {
  key: string;
  label: string;
  description: string;
  isComplete: boolean;
  action: "navigate" | "dialog" | "info";
  actionTarget?: string;
  priority: number;
}

export interface DataCompletenessResult {
  score: number;
  status: "complete" | "almost" | "needs-attention";
  items: DataCompletenessItem[];
  totalItems: number;
  completedItems: number;
}

export function useDataCompleteness(farmId: string) {
  return useQuery({
    queryKey: ["data-completeness", farmId],
    queryFn: async (): Promise<DataCompletenessResult> => {
      const threeMonthsAgo = format(subMonths(new Date(), 3), "yyyy-MM-dd");

      // Fetch all counts in parallel
      const [
        farmResult,
        animalsResult,
        weightResult,
        milkingResult,
        expensesResult,
        revenuesResult,
      ] = await Promise.all([
        // Farm data
        (supabase as any)
          .from("farms")
          .select("gps_lat, gps_lng, region, province, municipality")
          .eq("id", farmId)
          .single(),
        // Animals count
        (supabase as any)
          .from("animals")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .is("exit_date", null),
        // Weight records count
        (supabase as any)
          .from("weight_records")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId),
        // Milking records count (last 3 months)
        (supabase as any)
          .from("milking_records")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .gte("milking_date", threeMonthsAgo),
        // Expenses count (last 3 months)
        (supabase as any)
          .from("farm_expenses")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .gte("expense_date", threeMonthsAgo),
        // Revenues count (last 3 months)
        (supabase as any)
          .from("farm_revenues")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .gte("transaction_date", threeMonthsAgo),
      ]);

      const farm = farmResult.data;
      const animalsCount = animalsResult.count || 0;
      const weightCount = weightResult.count || 0;
      const milkingCount = milkingResult.count || 0;
      const expensesCount = expensesResult.count || 0;
      const revenuesCount = revenuesResult.count || 0;

      // Build completeness items
      const items: DataCompletenessItem[] = [
        {
          key: "gps",
          label: "Farm Location",
          description: "GPS coordinates for farm verification",
          isComplete: !!(farm?.gps_lat && farm?.gps_lng),
          action: "navigate",
          actionTarget: "profile",
          priority: 1,
        },
        {
          key: "address",
          label: "Complete Address",
          description: "Region, province, and municipality",
          isComplete: !!(farm?.region && farm?.province && farm?.municipality),
          action: "navigate",
          actionTarget: "profile",
          priority: 2,
        },
        {
          key: "animals",
          label: "Animal Inventory",
          description: "At least one animal registered",
          isComplete: animalsCount > 0,
          action: "navigate",
          actionTarget: "animals",
          priority: 3,
        },
        {
          key: "weights",
          label: "Weight Records",
          description: "Weight data for asset valuation",
          isComplete: weightCount > 0,
          action: "navigate",
          actionTarget: "animals",
          priority: 4,
        },
        {
          key: "production",
          label: "Production Records",
          description: "Milking data from last 3 months",
          isComplete: milkingCount >= 10,
          action: "navigate",
          actionTarget: "operations",
          priority: 5,
        },
        {
          key: "expenses",
          label: "Expense Tracking",
          description: "Financial records from last 3 months",
          isComplete: expensesCount >= 5,
          action: "dialog",
          actionTarget: "expense",
          priority: 6,
        },
        {
          key: "revenues",
          label: "Revenue Documentation",
          description: "Income records from last 3 months",
          isComplete: revenuesCount >= 3,
          action: "dialog",
          actionTarget: "revenue",
          priority: 7,
        },
      ];

      // Sort by priority, incomplete items first
      items.sort((a, b) => {
        if (a.isComplete !== b.isComplete) {
          return a.isComplete ? 1 : -1;
        }
        return a.priority - b.priority;
      });

      const completedItems = items.filter((item) => item.isComplete).length;
      const totalItems = items.length;
      const score = Math.round((completedItems / totalItems) * 100);

      let status: "complete" | "almost" | "needs-attention";
      if (score >= 100) {
        status = "complete";
      } else if (score >= 70) {
        status = "almost";
      } else {
        status = "needs-attention";
      }

      return {
        score,
        status,
        items,
        totalItems,
        completedItems,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!farmId,
  });
}

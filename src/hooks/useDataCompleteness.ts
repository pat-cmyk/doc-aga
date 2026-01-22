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
  metadata?: Record<string, number | string>;
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
        animalsWeightResult,
        milkingResult,
        expensesResult,
        revenuesResult,
      ] = await Promise.all([
        // Farm data including bank-required fields
        (supabase as any)
          .from("farms")
          .select("gps_lat, gps_lng, region, province, municipality, biosecurity_level, water_source, distance_to_market_km, pcic_enrolled")
          .eq("id", farmId)
          .single(),
        // Animals count
        (supabase as any)
          .from("animals")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .is("exit_date", null),
        // Animals with weight data for completeness check
        (supabase as any)
          .from("animals")
          .select("id, entry_weight_kg, entry_weight_unknown, birth_weight_kg, birth_date, farm_entry_date")
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .is("exit_date", null),
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
      const animalsWithWeightData = animalsWeightResult.data || [];
      const milkingCount = milkingResult.count || 0;
      const expensesCount = expensesResult.count || 0;
      const revenuesCount = revenuesResult.count || 0;

      // Calculate missing weight counts
      let missingWeightCount = 0;
      animalsWithWeightData.forEach((animal: any) => {
        const isAcquired = animal.farm_entry_date !== null;
        if (isAcquired) {
          // Acquired animals need entry weight (unless marked unknown)
          if (!animal.entry_weight_kg && !animal.entry_weight_unknown) {
            missingWeightCount++;
          }
        } else {
          // Farm-born animals need birth weight
          if (animal.birth_date && !animal.birth_weight_kg) {
            missingWeightCount++;
          }
        }
      });
      const totalAnimals = animalsWithWeightData.length;

      // Calculate bank field completeness
      const bankFieldsFilled = [
        farm?.biosecurity_level,
        farm?.water_source,
        farm?.distance_to_market_km !== null && farm?.distance_to_market_km !== undefined,
        farm?.pcic_enrolled !== null && farm?.pcic_enrolled !== undefined,
      ].filter(Boolean).length;
      const allBankFieldsComplete = bankFieldsFilled === 4;
      const missingBankFields = 4 - bankFieldsFilled;

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
          label: "Animal Weight Data",
          description: totalAnimals === 0
            ? "No animals to track"
            : missingWeightCount > 0
              ? `${missingWeightCount} animal${missingWeightCount > 1 ? "s" : ""} missing weight for valuation`
              : "Weight data complete for asset valuation",
          isComplete: totalAnimals === 0 || missingWeightCount === 0,
          action: "navigate",
          actionTarget: "animals-weight",
          priority: 4,
          metadata: { missingCount: missingWeightCount, totalAnimals },
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
        {
          key: "bankInfo",
          label: "Bank Requirements",
          description: allBankFieldsComplete
            ? "All bank fields complete"
            : bankFieldsFilled > 0
              ? `${missingBankFields} of 4 bank fields incomplete`
              : "Biosecurity, water source, market distance, insurance",
          isComplete: allBankFieldsComplete,
          action: "dialog",
          actionTarget: "bankInfo",
          priority: 8,
          metadata: { filledCount: bankFieldsFilled, totalFields: 4 },
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

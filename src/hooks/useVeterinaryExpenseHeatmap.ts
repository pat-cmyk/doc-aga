import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VeterinaryExpenseData {
  municipality: string;
  province: string;
  region: string;
  totalVetExpenses: number;
  totalMedicineExpenses: number;
  combinedTotal: number;
  animalCount: number;
  costPerAnimal: number;
  farmCount: number;
}

export interface VeterinaryExpenseSummary {
  totalVetExpenses: number;
  totalMedicineExpenses: number;
  totalCombined: number;
  avgCostPerAnimal: number;
  totalAnimals: number;
  totalFarms: number;
  byLocation: VeterinaryExpenseData[];
}

export const useVeterinaryExpenseHeatmap = (
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<VeterinaryExpenseSummary>({
    queryKey: ["veterinary-expense-heatmap", region || "all", province || "all", municipality || "all"],
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Fetch expenses with farm location
      let expensesQuery = supabase
        .from("farm_expenses")
        .select(`
          id,
          amount,
          category,
          farms!inner(id, region, province, municipality)
        `)
        .in("category", ["Veterinary Services", "Medicine & Vaccines", "veterinary", "medicine"])
        .eq("is_deleted", false);

      if (region) expensesQuery = expensesQuery.eq("farms.region", region);
      if (province) expensesQuery = expensesQuery.eq("farms.province", province);
      if (municipality) expensesQuery = expensesQuery.eq("farms.municipality", municipality);

      const { data: expenses, error: expensesError } = await expensesQuery;
      if (expensesError) throw expensesError;

      // Fetch animal counts by farm
      let animalsQuery = supabase
        .from("animals")
        .select(`
          id,
          farm_id,
          farms!inner(id, region, province, municipality)
        `)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (region) animalsQuery = animalsQuery.eq("farms.region", region);
      if (province) animalsQuery = animalsQuery.eq("farms.province", province);
      if (municipality) animalsQuery = animalsQuery.eq("farms.municipality", municipality);

      const { data: animals, error: animalsError } = await animalsQuery;
      if (animalsError) throw animalsError;

      // Group by location (municipality level for granularity)
      const locationData: Record<string, {
        vetExpenses: number;
        medicineExpenses: number;
        animalCount: number;
        farmIds: Set<string>;
        province: string;
        region: string;
      }> = {};

      // Process expenses
      expenses?.forEach((expense) => {
        const farm = expense.farms as any;
        const key = `${farm.municipality || "Unknown"}-${farm.province || "Unknown"}-${farm.region || "Unknown"}`;
        
        if (!locationData[key]) {
          locationData[key] = {
            vetExpenses: 0,
            medicineExpenses: 0,
            animalCount: 0,
            farmIds: new Set(),
            province: farm.province || "Unknown",
            region: farm.region || "Unknown",
          };
        }

        const category = expense.category?.toLowerCase() || "";
        if (category.includes("veterinary") || category === "veterinary services") {
          locationData[key].vetExpenses += expense.amount || 0;
        } else {
          locationData[key].medicineExpenses += expense.amount || 0;
        }
        locationData[key].farmIds.add(farm.id);
      });

      // Process animal counts
      animals?.forEach((animal) => {
        const farm = animal.farms as any;
        const key = `${farm.municipality || "Unknown"}-${farm.province || "Unknown"}-${farm.region || "Unknown"}`;
        
        if (!locationData[key]) {
          locationData[key] = {
            vetExpenses: 0,
            medicineExpenses: 0,
            animalCount: 0,
            farmIds: new Set(),
            province: farm.province || "Unknown",
            region: farm.region || "Unknown",
          };
        }
        
        locationData[key].animalCount++;
        locationData[key].farmIds.add(farm.id);
      });

      // Convert to array and calculate derived metrics
      const byLocation: VeterinaryExpenseData[] = Object.entries(locationData)
        .map(([key, data]) => {
          const [municipality] = key.split("-");
          const combinedTotal = data.vetExpenses + data.medicineExpenses;
          const costPerAnimal = data.animalCount > 0 ? combinedTotal / data.animalCount : 0;

          return {
            municipality,
            province: data.province,
            region: data.region,
            totalVetExpenses: Math.round(data.vetExpenses * 100) / 100,
            totalMedicineExpenses: Math.round(data.medicineExpenses * 100) / 100,
            combinedTotal: Math.round(combinedTotal * 100) / 100,
            animalCount: data.animalCount,
            costPerAnimal: Math.round(costPerAnimal * 100) / 100,
            farmCount: data.farmIds.size,
          };
        })
        .filter(loc => loc.combinedTotal > 0)
        .sort((a, b) => b.combinedTotal - a.combinedTotal);

      // Calculate summary totals
      const totalVetExpenses = byLocation.reduce((sum, loc) => sum + loc.totalVetExpenses, 0);
      const totalMedicineExpenses = byLocation.reduce((sum, loc) => sum + loc.totalMedicineExpenses, 0);
      const totalAnimals = byLocation.reduce((sum, loc) => sum + loc.animalCount, 0);
      const totalFarms = new Set(expenses?.map(e => (e.farms as any).id) || []).size;

      return {
        totalVetExpenses: Math.round(totalVetExpenses * 100) / 100,
        totalMedicineExpenses: Math.round(totalMedicineExpenses * 100) / 100,
        totalCombined: Math.round((totalVetExpenses + totalMedicineExpenses) * 100) / 100,
        avgCostPerAnimal: totalAnimals > 0 
          ? Math.round(((totalVetExpenses + totalMedicineExpenses) / totalAnimals) * 100) / 100 
          : 0,
        totalAnimals,
        totalFarms,
        byLocation,
      };
    },
  });
};

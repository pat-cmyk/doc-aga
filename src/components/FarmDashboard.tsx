import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import HealthEventsDialog from "./HealthEventsDialog";
import { generateFeedForecast, type MonthlyFeedForecast } from "@/lib/feedForecast";
import { FeedForecast } from "./FeedForecast";
import { estimateWeightByAge } from "@/lib/weightEstimates";
import { calculateLifeStage, calculateMilkingStage, type AnimalStageData } from "@/lib/animalStages";
import { DashboardStats } from "./farm-dashboard/DashboardStats";
import { LazyMilkProductionChart, LazyHeadcountChart } from "./lazy/LazyCharts";
import { useCombinedDashboardData } from "./farm-dashboard/hooks/useCombinedDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface FarmDashboardProps {
  farmId: string;
  onNavigateToAnimals?: () => void;
  onNavigateToAnimalDetails?: (animalId: string) => void;
}

const FarmDashboard = ({ farmId, onNavigateToAnimals, onNavigateToAnimalDetails }: FarmDashboardProps) => {
  const [feedForecast, setFeedForecast] = useState<MonthlyFeedForecast[]>([]);
  const [showFeedForecast, setShowFeedForecast] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"last30" | "ytd">("last30");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyTimePeriod, setMonthlyTimePeriod] = useState<"all" | "ytd">("ytd");
  const { toast } = useToast();

  // Memoize date calculations
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (timePeriod) {
      case "last30":
        endDate = now;
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "ytd":
        startDate = new Date(selectedYear, 0, 1);
        if (selectedYear === now.getFullYear()) {
          endDate = now;
        } else {
          endDate = new Date(selectedYear, 11, 31);
        }
        break;
    }
    
    return { startDate, endDate };
  }, [timePeriod, selectedYear]);

  const { monthlyStartDate, monthlyEndDate } = useMemo(() => {
    const now = new Date();
    let monthlyStartDate: Date;
    let monthlyEndDate: Date;
    
    if (monthlyTimePeriod === "all") {
      monthlyStartDate = new Date(selectedYear, 0, 1);
      monthlyEndDate = new Date();
    } else {
      monthlyStartDate = new Date(selectedYear, 0, 1);
      monthlyEndDate = selectedYear === now.getFullYear() 
        ? now 
        : new Date(selectedYear, 11, 31);
    }
    
    return { monthlyStartDate, monthlyEndDate };
  }, [monthlyTimePeriod, selectedYear]);

  // Memoize date array
  const dateArray = useMemo(() => {
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // Use combined hook to fetch all data in one RPC call (reduces 10+ queries to 1)
  const { stats, combinedData, monthlyHeadcount, stageKeys, loading, reload: reloadStats } = 
    useCombinedDashboardData(farmId, startDate, endDate, monthlyStartDate, monthlyEndDate, dateArray);

  const lastReloadRef = useRef(0);

  const loadFeedForecast = useCallback(async () => {
    try {
      const { data: animals } = await supabase
        .from("animals")
        .select("id, birth_date, gender, milking_start_date, livestock_type")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      if (!animals) return;

      // Get offspring data
      const { data: allOffspring } = await supabase
        .from("animals")
        .select("mother_id, birth_date")
        .eq("farm_id", farmId)
        .not("mother_id", "is", null);

      const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
      allOffspring?.forEach(offspring => {
        if (!offspring.mother_id) return;
        if (!offspringByMother.has(offspring.mother_id)) {
          offspringByMother.set(offspring.mother_id, []);
        }
        offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
      });

      const animalsWithStages = animals.map(animal => {
        if (!animal.birth_date) return null;

        const birthDate = new Date(animal.birth_date);
        const offspring = offspringByMother.get(animal.id) || [];
        const lastCalvingDate = offspring[0]?.birth_date ? new Date(offspring[0].birth_date) : null;

        const stageData: AnimalStageData = {
          birthDate,
          gender: animal.gender,
          milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
          offspringCount: offspring.length,
          lastCalvingDate,
          hasRecentMilking: false,
          hasActiveAI: false,
          livestockType: animal.livestock_type,
        };

        const lifeStage = calculateLifeStage(stageData);
        const milkingStage = calculateMilkingStage(stageData);
        const stage = milkingStage || lifeStage;
        const weightKg = estimateWeightByAge({
          birthDate,
          gender: animal.gender || 'female',
          lifeStage: stage
        });

        return {
          id: animal.id,
          stage,
          weightKg,
          birthDate,
        };
      }).filter(Boolean);

      const forecast = generateFeedForecast(animalsWithStages as any);
      setFeedForecast(forecast);
    } catch (error) {
      console.error("Error loading feed forecast:", error);
    }
  }, [farmId]);

  // Defer feed forecast loading using requestIdleCallback for better performance
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(() => {
        loadFeedForecast();
      });
      return () => cancelIdleCallback(handle);
    } else {
      // Fallback for browsers without requestIdleCallback
      const timeout = setTimeout(loadFeedForecast, 100);
      return () => clearTimeout(timeout);
    }
  }, [farmId, loadFeedForecast]);

  // Real-time subscription for milking records with throttling
  useEffect(() => {
    const channel = supabase
      .channel('milking-records-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'milking_records'
      }, () => {
        const now = Date.now();
        if (now - lastReloadRef.current > 2000) {
          lastReloadRef.current = now;
          console.log('New milking record added, refreshing dashboard...');
          reloadStats();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId, reloadStats]);


  return (
    <div className="space-y-6">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <DashboardStats stats={stats} />
      )}

      {/* Lazy load charts to reduce initial bundle size */}
      <LazyMilkProductionChart
        data={combinedData}
        timePeriod={timePeriod}
        selectedYear={selectedYear}
        onTimePeriodChange={setTimePeriod}
        onYearChange={setSelectedYear}
      />

      <LazyHeadcountChart
        data={monthlyHeadcount}
        stageKeys={stageKeys}
        monthlyTimePeriod={monthlyTimePeriod}
        selectedYear={selectedYear}
        onMonthlyTimePeriodChange={setMonthlyTimePeriod}
        onYearChange={setSelectedYear}
      />

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={() => setShowFeedForecast(!showFeedForecast)}
        >
          <Sprout className="h-4 w-4 mr-2" />
          {showFeedForecast ? "Hide" : "Show"} Feed Forecast
        </Button>
      </div>

      {showFeedForecast && <FeedForecast forecasts={feedForecast} />}

      <HealthEventsDialog
        farmId={farmId}
        open={healthDialogOpen}
        onClose={() => setHealthDialogOpen(false)}
        onNavigateToAnimal={(animalId) => onNavigateToAnimalDetails?.(animalId)}
      />
    </div>
  );
};

export default FarmDashboard;

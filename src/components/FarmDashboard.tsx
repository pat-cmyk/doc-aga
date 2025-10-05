import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Milk, Activity, Calendar, TrendingUp, Database, Sprout } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, Legend, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HealthEventsDialog from "./HealthEventsDialog";
import { calculateLifeStage, calculateMilkingStage, type AnimalStageData } from "@/lib/animalStages";
import { generateFeedForecast, type MonthlyFeedForecast } from "@/lib/feedForecast";
import { FeedForecast } from "./FeedForecast";
import { estimateWeightByAge } from "@/lib/weightEstimates";

interface FarmDashboardProps {
  farmId: string;
  onNavigateToAnimals?: () => void;
  onNavigateToAnimalDetails?: (animalId: string) => void;
}

interface DashboardStats {
  totalAnimals: number;
  avgDailyMilk: number;
  pregnantCount: number;
  pendingConfirmation: number;
  recentHealthEvents: number;
}

interface CombinedDailyData {
  date: string;
  milkTotal: number;
  [key: string]: string | number; // Dynamic stage counts
}

interface MonthlyHeadcount {
  month: string;
  [key: string]: string | number; // Dynamic stage counts
}

const FarmDashboard = ({ farmId, onNavigateToAnimals, onNavigateToAnimalDetails }: FarmDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    pendingConfirmation: 0,
    recentHealthEvents: 0
  });
  const [combinedData, setCombinedData] = useState<CombinedDailyData[]>([]);
  const [stageKeys, setStageKeys] = useState<string[]>([]);
  const [monthlyHeadcount, setMonthlyHeadcount] = useState<MonthlyHeadcount[]>([]);
  const [feedForecast, setFeedForecast] = useState<MonthlyFeedForecast[]>([]);
  const [showFeedForecast, setShowFeedForecast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"last30" | "ytd">("last30");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyTimePeriod, setMonthlyTimePeriod] = useState<"all" | "ytd">("ytd");
  const [backfilling, setBackfilling] = useState(false);
  const [populatingWeights, setPopulatingWeights] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    loadFeedForecast();
  }, [farmId, timePeriod, selectedYear, monthlyTimePeriod]);

  // Real-time subscription for milking records
  useEffect(() => {
    const channel = supabase
      .channel('milking-records-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'milking_records'
        },
        () => {
          console.log('New milking record added, refreshing dashboard...');
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId, timePeriod, selectedYear, monthlyTimePeriod]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (timePeriod) {
      case "last30": // Last 30 Days
        endDate = now;
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "ytd": // Year to Date
        startDate = new Date(selectedYear, 0, 1); // January 1st of selected year
        // If selected year is current year, use today, otherwise use end of year
        if (selectedYear === now.getFullYear()) {
          endDate = now;
        } else {
          endDate = new Date(selectedYear, 11, 31); // December 31st of selected year
        }
        break;
    }
    
    return { startDate, endDate };
  };

  const loadDashboardData = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      // For monthly headcount, use filter setting
      let monthlyStartDate: Date;
      let monthlyEndDate: Date;
      
      if (monthlyTimePeriod === "all") {
        // Get the earliest animal birth date for all-time view
        const { data: oldestAnimal } = await supabase
          .from("animals")
          .select("birth_date")
          .eq("farm_id", farmId)
          .order("birth_date", { ascending: true })
          .limit(1);
        
        monthlyStartDate = oldestAnimal?.[0]?.birth_date 
          ? new Date(oldestAnimal[0].birth_date)
          : new Date(selectedYear, 0, 1);
        monthlyEndDate = new Date();
      } else {
        // YTD of selected year
        monthlyStartDate = new Date(selectedYear, 0, 1);
        monthlyEndDate = selectedYear === new Date().getFullYear() 
          ? new Date() 
          : new Date(selectedYear, 11, 31);
      }
      
      // Get total animals
      const { count: animalCount } = await supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      // Get average daily milk
      const { data: milkingData } = await supabase
        .from("milking_records")
        .select("liters, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", startDate.toISOString().split("T")[0]);

      const avgMilk = milkingData && milkingData.length > 0
        ? milkingData.reduce((sum, r) => sum + Number(r.liters), 0) / milkingData.length
        : 0;

      // Get pregnant animals (from AI records with pregnancy confirmed)
      const { data: pregnancyData } = await supabase
        .from("ai_records")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("pregnancy_confirmed", true);

      // Get AI performed but pending confirmation
      const { data: pendingAI } = await supabase
        .from("ai_records")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("pregnancy_confirmed", false)
        .not("performed_date", "is", null);

      // Get recent health events
      const { count: healthCount } = await supabase
        .from("health_records")
        .select("*, animals!inner(farm_id)", { count: "exact", head: true })
        .eq("animals.farm_id", farmId)
        .gte("visit_date", startDate.toISOString().split("T")[0]);

      // Fetch pre-aggregated data from daily_farm_stats table for milk production
      const { data: dailyStats, error: statsError } = await supabase
        .from("daily_farm_stats")
        .select("*")
        .eq("farm_id", farmId)
        .gte("stat_date", startDate.toISOString().split("T")[0])
        .lte("stat_date", endDate.toISOString().split("T")[0])
        .order("stat_date", { ascending: true });

      // Fetch pre-aggregated data for monthly headcount
      const { data: monthlyStats, error: monthlyStatsError } = await supabase
        .from("monthly_farm_stats")
        .select("*")
        .eq("farm_id", farmId)
        .gte("month_date", monthlyStartDate.toISOString().split("T")[0])
        .lte("month_date", monthlyEndDate.toISOString().split("T")[0])
        .order("month_date", { ascending: true });

      if (statsError) {
        console.error("Error fetching daily stats:", statsError);
      }
      if (monthlyStatsError) {
        console.error("Error fetching monthly stats:", monthlyStatsError);
      }

      // Create array of dates for the selected period
      const dateArray: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dateArray.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Initialize combined data structure
      const combinedDataMap: Record<string, CombinedDailyData> = {};
      const allStageKeys = new Set<string>();

      dateArray.forEach(date => {
        combinedDataMap[date] = {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          milkTotal: 0
        };
      });

      // Check if we have pre-calculated data
      if (dailyStats && dailyStats.length > 0) {
        // Use pre-calculated data from daily_farm_stats
        dailyStats.forEach(stat => {
          const date = stat.stat_date;
          if (combinedDataMap[date]) {
            combinedDataMap[date].milkTotal = Number(stat.total_milk_liters);
            
            // Add stage counts from JSONB
            const stageCounts = stat.stage_counts as Record<string, number>;
            Object.entries(stageCounts).forEach(([stage, count]) => {
              combinedDataMap[date][stage] = count;
              allStageKeys.add(stage);
            });
          }
        });
      } else {
        // Fallback: Calculate from milking_records and animals in real-time
        console.log("No pre-calculated stats found, using fallback calculation");
        
        // Get milk records
        const { data: milkRecords } = await supabase
          .from("milking_records")
          .select("liters, record_date, animals!inner(farm_id)")
          .eq("animals.farm_id", farmId)
          .gte("record_date", startDate.toISOString().split("T")[0])
          .lte("record_date", endDate.toISOString().split("T")[0]);

        milkRecords?.forEach(record => {
          const date = record.record_date;
          if (combinedDataMap[date]) {
            combinedDataMap[date].milkTotal += Number(record.liters);
          }
        });

        // Get all animals for the farm to calculate stages
        const { data: allAnimals } = await supabase
          .from("animals")
          .select("id, birth_date, gender, milking_start_date, mother_id")
          .eq("farm_id", farmId)
          .eq("is_deleted", false);

        // Get offspring data for last calving dates
        const { data: allOffspring } = await supabase
          .from("animals")
          .select("id, mother_id, birth_date")
          .eq("farm_id", farmId)
          .not("mother_id", "is", null)
          .order("birth_date", { ascending: false });

        // Get recent AI records (last 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const { data: aiRecords } = await supabase
          .from("ai_records")
          .select("animal_id")
          .gte("scheduled_date", ninetyDaysAgo.toISOString().split("T")[0]);

        const animalsWithActiveAI = new Set(aiRecords?.map(r => r.animal_id) || []);

        // Get recent milking records (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: recentMilking } = await supabase
          .from("milking_records")
          .select("animal_id")
          .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0]);

        const animalsWithRecentMilking = new Set(recentMilking?.map(r => r.animal_id) || []);

        // Create offspring lookup map
        const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
        allOffspring?.forEach(offspring => {
          if (!offspring.mother_id) return;
          if (!offspringByMother.has(offspring.mother_id)) {
            offspringByMother.set(offspring.mother_id, []);
          }
          offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
        });

        // Calculate stages for each date in the range
        dateArray.forEach(date => {
          const stageCounts: Record<string, number> = {};

          allAnimals?.forEach(animal => {
            if (!animal.birth_date) return;

            const birthDate = new Date(animal.birth_date);
            const offspring = offspringByMother.get(animal.id) || [];
            const lastCalvingDate = offspring[0]?.birth_date ? new Date(offspring[0].birth_date) : null;

            const stageData: AnimalStageData = {
              birthDate,
              gender: animal.gender,
              milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
              offspringCount: offspring.length,
              lastCalvingDate,
              hasRecentMilking: animalsWithRecentMilking.has(animal.id),
              hasActiveAI: animalsWithActiveAI.has(animal.id),
            };

            let stageForCount: string | null = null;

            if (animal.gender?.toLowerCase() === 'female') {
              const lifeStage = calculateLifeStage(stageData);
              const milkingStage = calculateMilkingStage(stageData);
              stageForCount = milkingStage || lifeStage;
            } else if (animal.gender?.toLowerCase() === 'male') {
              // Basic male categorization
              const ageInMonths = Math.floor((new Date().getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
              if (ageInMonths < 12) stageForCount = "Bull Calf";
              else if (ageInMonths < 24) stageForCount = "Young Bull";
              else stageForCount = "Mature Bull";
            }

            if (stageForCount) {
              stageCounts[stageForCount] = (stageCounts[stageForCount] || 0) + 1;
              allStageKeys.add(stageForCount);
            }
          });

          // Add stage counts to the date
          Object.entries(stageCounts).forEach(([stage, count]) => {
            if (combinedDataMap[date]) {
              combinedDataMap[date][stage] = count;
            }
          });
        });
      }

      const finalData = dateArray.map(date => combinedDataMap[date]);
      const stageKeysArray = Array.from(allStageKeys);

      // Calculate monthly headcount aggregation from YTD data
      const monthlyMap: Record<string, MonthlyHeadcount> = {};
      
      // Process monthly stats data
      if (monthlyStats && monthlyStats.length > 0) {
        // Use pre-calculated stats for monthly aggregation
        monthlyStats.forEach(stat => {
          const statDate = new Date(stat.month_date);
          const monthKey = statDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          
          if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { month: monthKey };
            stageKeysArray.forEach(stage => {
              monthlyMap[monthKey][stage] = 0;
            });
          }

          // Use the last day of each month as the snapshot
          const stageCounts = stat.stage_counts as Record<string, number>;
          Object.entries(stageCounts).forEach(([stage, count]) => {
            monthlyMap[monthKey][stage] = count;
          });
        });
      } else {
        // Fallback: calculate from animals if no pre-calculated stats
        const monthlyDateArray: string[] = [];
        const currentMonthDate = new Date(monthlyStartDate);
        while (currentMonthDate <= monthlyEndDate) {
          monthlyDateArray.push(currentMonthDate.toISOString().split("T")[0]);
          currentMonthDate.setDate(currentMonthDate.getDate() + 1);
        }

        // Get all animals for the farm
        const { data: allAnimals } = await supabase
          .from("animals")
          .select("id, birth_date, gender, milking_start_date, mother_id")
          .eq("farm_id", farmId)
          .eq("is_deleted", false);

        const { data: allOffspring } = await supabase
          .from("animals")
          .select("id, mother_id, birth_date")
          .eq("farm_id", farmId)
          .not("mother_id", "is", null)
          .order("birth_date", { ascending: false });

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const { data: aiRecords } = await supabase
          .from("ai_records")
          .select("animal_id")
          .gte("scheduled_date", ninetyDaysAgo.toISOString().split("T")[0]);

        const animalsWithActiveAI = new Set(aiRecords?.map(r => r.animal_id) || []);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: recentMilking } = await supabase
          .from("milking_records")
          .select("animal_id")
          .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0]);

        const animalsWithRecentMilking = new Set(recentMilking?.map(r => r.animal_id) || []);

        const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
        allOffspring?.forEach(offspring => {
          if (!offspring.mother_id) return;
          if (!offspringByMother.has(offspring.mother_id)) {
            offspringByMother.set(offspring.mother_id, []);
          }
          offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
        });

        // Group dates by month and calculate stages for last day of each month
        const monthGroups: Record<string, string[]> = {};
        monthlyDateArray.forEach(date => {
          const dateObj = new Date(date);
          const monthKey = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = [];
          }
          monthGroups[monthKey].push(date);
        });

        Object.entries(monthGroups).forEach(([monthKey, dates]) => {
          const lastDateOfMonth = dates[dates.length - 1]; // Use last day of month
          const stageCounts: Record<string, number> = {};

          allAnimals?.forEach(animal => {
            if (!animal.birth_date) return;

            const birthDate = new Date(animal.birth_date);
            const offspring = offspringByMother.get(animal.id) || [];
            const lastCalvingDate = offspring[0]?.birth_date ? new Date(offspring[0].birth_date) : null;

            const stageData: AnimalStageData = {
              birthDate,
              gender: animal.gender,
              milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
              offspringCount: offspring.length,
              lastCalvingDate,
              hasRecentMilking: animalsWithRecentMilking.has(animal.id),
              hasActiveAI: animalsWithActiveAI.has(animal.id),
            };

            let stageForCount: string | null = null;

            if (animal.gender?.toLowerCase() === 'female') {
              const lifeStage = calculateLifeStage(stageData);
              const milkingStage = calculateMilkingStage(stageData);
              stageForCount = milkingStage || lifeStage;
            } else if (animal.gender?.toLowerCase() === 'male') {
              const ageInMonths = Math.floor((new Date(lastDateOfMonth).getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
              if (ageInMonths < 12) stageForCount = "Bull Calf";
              else if (ageInMonths < 24) stageForCount = "Young Bull";
              else stageForCount = "Mature Bull";
            }

            if (stageForCount) {
              stageCounts[stageForCount] = (stageCounts[stageForCount] || 0) + 1;
            }
          });

          monthlyMap[monthKey] = { month: monthKey, ...stageCounts };
        });
      }

      const monthlyData = Object.values(monthlyMap);

      setCombinedData(finalData);
      setStageKeys(stageKeysArray);
      setMonthlyHeadcount(monthlyData);

      setStats({
        totalAnimals: animalCount || 0,
        avgDailyMilk: Number(avgMilk.toFixed(2)),
        pregnantCount: pregnancyData?.length || 0,
        pendingConfirmation: pendingAI?.length || 0,
        recentHealthEvents: healthCount || 0
      });
    } catch (error: any) {
      toast({
        title: "Error loading dashboard",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackfillData = async () => {
    setBackfilling(true);
    try {
      // Backfill from earliest animal birth date to today
      const startDate = '2020-01-01'; // Start from beginning or earliest date
      const endDate = new Date().toISOString().split('T')[0];

      toast({
        title: "Backfilling historical data...",
        description: "This may take a minute or two.",
      });

      const { data, error } = await supabase.functions.invoke('backfill-stats', {
        body: {
          farmId,
          startDate,
          endDate,
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Backfilled ${data.processed} days of historical data.`,
      });

      // Reload dashboard data
      await loadDashboardData();
    } catch (error: any) {
      console.error('Error backfilling data:', error);
      toast({
        title: "Error backfilling data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setBackfilling(false);
    }
  };

  const loadFeedForecast = async () => {
    try {
      // Get all animals with weight data
      const { data: animals, error } = await supabase
        .from("animals")
        .select("id, birth_date, gender, current_weight_kg")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      if (error) throw error;

      // Get stage data for each animal
      const animalsWithStages = await Promise.all(
        (animals || []).map(async (animal) => {
          if (!animal.birth_date) return null;

          // Get offspring count
          const { count: offspringCount } = await supabase
            .from("animals")
            .select("*", { count: "exact", head: true })
            .eq("mother_id", animal.id);

          // Get last calving date
          const { data: offspring } = await supabase
            .from("animals")
            .select("birth_date")
            .eq("mother_id", animal.id)
            .order("birth_date", { ascending: false })
            .limit(1);

          // Check for recent milking
          const { data: recentMilking } = await supabase
            .from("milking_records")
            .select("id")
            .eq("animal_id", animal.id)
            .gte("record_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          const stageData: AnimalStageData = {
            birthDate: new Date(animal.birth_date),
            gender: animal.gender,
            milkingStartDate: null,
            offspringCount: offspringCount || 0,
            lastCalvingDate: offspring?.[0]?.birth_date ? new Date(offspring[0].birth_date) : null,
            hasRecentMilking: (recentMilking?.length || 0) > 0,
            hasActiveAI: false,
          };

          const lifeStage = calculateLifeStage(stageData);
          const milkingStage = calculateMilkingStage(stageData);

          // Estimate weight if not set
          let weight = animal.current_weight_kg;
          if (!weight) {
            weight = estimateWeightByAge({
              birthDate: new Date(animal.birth_date),
              gender: animal.gender || "female",
              lifeStage,
            });
          }

          return {
            id: animal.id,
            birth_date: animal.birth_date,
            gender: animal.gender || "female",
            life_stage: lifeStage,
            milking_stage: milkingStage,
            current_weight_kg: weight,
          };
        })
      );

      const validAnimals = animalsWithStages.filter(a => a !== null);
      const forecast = generateFeedForecast(validAnimals as any);
      setFeedForecast(forecast);
    } catch (error: any) {
      console.error("Error loading feed forecast:", error);
    }
  };

  const handlePopulateWeights = async () => {
    setPopulatingWeights(true);
    try {
      toast({
        title: "Populating weight estimates...",
        description: "Calculating weights for all animals",
      });

      const { data, error } = await supabase.functions.invoke('populate-weights', {
        body: { farmId },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Weight estimates added for ${data.populated} animals.`,
      });

      // Reload dashboard and forecast
      await loadDashboardData();
      await loadFeedForecast();
    } catch (error: any) {
      console.error('Error populating weights:', error);
      toast({
        title: "Error populating weights",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setPopulatingWeights(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card 
          className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
          onClick={onNavigateToAnimals}
        >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAnimals}</div>
          <p className="text-xs text-muted-foreground">In your herd</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Daily Milk</CardTitle>
          <Milk className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgDailyMilk}L</div>
          <p className="text-xs text-muted-foreground">
            Per animal ({timePeriod === "last30" ? "Last 30 Days" : `YTD ${selectedYear}`})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pregnant Cows</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pregnantCount}</div>
          <p className="text-xs text-muted-foreground">Confirmed pregnancies</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Confirmation</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingConfirmation}</div>
          <p className="text-xs text-muted-foreground">AI performed, awaiting</p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
        onClick={() => setHealthDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Health Events</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.recentHealthEvents}</div>
          <p className="text-xs text-muted-foreground">
            {timePeriod === "last30" ? "Last 30 Days" : `Year ${selectedYear}`}
          </p>
        </CardContent>
      </Card>
      </div>

      {/* Milk Production Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <CardTitle className="text-base sm:text-lg">Daily Milk Production</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-full sm:w-[100px] min-h-[44px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as "last30" | "ytd")} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-2 min-h-[44px]">
                  <TabsTrigger value="last30" className="min-h-[40px]">Last 30 Days</TabsTrigger>
                  <TabsTrigger value="ytd" className="min-h-[40px]">YTD</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {combinedData.length > 0 ? (
            <ChartContainer
              config={{
                milkTotal: {
                  label: "Milk (Liters)",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[250px] sm:h-[350px] lg:h-[400px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillMilk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}L`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="milkTotal"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#fillMilk)"
                    name="Milk (L)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[250px] sm:h-[350px] lg:h-[400px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Milk className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Cattle Headcount Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">Monthly Cattle Headcount by Stage</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackfillData}
                disabled={backfilling}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {backfilling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Fill Historical Data</span>
                    <span className="sm:hidden">Fill Data</span>
                  </>
                )}
              </Button>
              <Tabs value={monthlyTimePeriod} onValueChange={(v) => setMonthlyTimePeriod(v as "all" | "ytd")} className="w-full sm:w-auto">
                <TabsList className="w-full min-h-[44px]">
                  <TabsTrigger value="ytd" className="min-h-[40px] flex-1">YTD</TabsTrigger>
                  <TabsTrigger value="all" className="min-h-[40px] flex-1">All Time</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyHeadcount.length > 0 && stageKeys.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <ChartContainer
                config={{
                  ...Object.fromEntries(
                    stageKeys.map((stage, idx) => {
                      const colors = [
                        "hsl(220, 70%, 60%)", // Blue
                        "hsl(160, 60%, 50%)", // Teal
                        "hsl(280, 65%, 60%)", // Purple
                        "hsl(30, 80%, 55%)",  // Orange
                        "hsl(340, 75%, 55%)", // Pink
                        "hsl(120, 60%, 50%)", // Green
                        "hsl(200, 70%, 55%)", // Cyan
                        "hsl(350, 80%, 60%)", // Red
                      ];
                      return [
                        stage,
                        {
                          label: stage,
                          color: colors[idx % colors.length],
                        },
                      ];
                    })
                  ),
                }}
                className="h-[300px] sm:h-[350px] lg:h-[400px] w-full min-w-[500px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyHeadcount} margin={{ left: 0, right: 0, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="month"
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      className="text-xs"
                      tickLine={false}
                      axisLine={false}
                      label={{ value: "Head Count", angle: -90, position: "insideLeft" }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    {stageKeys.map((stage, idx) => {
                      const colors = [
                        "hsl(220, 70%, 60%)", // Blue
                        "hsl(160, 60%, 50%)", // Teal
                        "hsl(280, 65%, 60%)", // Purple
                        "hsl(30, 80%, 55%)",  // Orange
                        "hsl(340, 75%, 55%)", // Pink
                        "hsl(120, 60%, 50%)", // Green
                        "hsl(200, 70%, 55%)", // Cyan
                        "hsl(350, 80%, 60%)", // Red
                      ];
                      return (
                        <Bar
                          key={stage}
                          dataKey={stage}
                          stackId="a"
                          fill={colors[idx % colors.length]}
                          radius={idx === stageKeys.length - 1 ? [4, 4, 0, 0] : 0}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No headcount data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed Forecast Section */}
      {feedForecast.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Sprout className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">Feed Requirements Forecast (6 Months)</span>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePopulateWeights}
                  disabled={populatingWeights}
                  className="min-h-[44px] flex-1 sm:flex-none"
                >
                  {populatingWeights ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Calculating...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Initialize Weights</span>
                      <span className="sm:hidden">Init Weights</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFeedForecast(!showFeedForecast)}
                  className="min-h-[44px] flex-1 sm:flex-none"
                >
                  {showFeedForecast ? "Hide" : "Show"}<span className="hidden sm:inline"> Details</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showFeedForecast ? (
              <FeedForecast forecasts={feedForecast} />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Next Month</p>
                  <p className="text-2xl font-bold">{feedForecast[0]?.totalFeedKgPerMonth.toLocaleString()} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Daily Average</p>
                  <p className="text-2xl font-bold">{feedForecast[0]?.totalFeedKgPerDay} kg</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">6-Month Total</p>
                  <p className="text-2xl font-bold">
                    {feedForecast.reduce((sum, f) => sum + f.totalFeedKgPerMonth, 0).toLocaleString()} kg
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <HealthEventsDialog
        farmId={farmId}
        open={healthDialogOpen}
        onClose={() => setHealthDialogOpen(false)}
        onNavigateToAnimal={(animalId) => {
          if (onNavigateToAnimalDetails) {
            onNavigateToAnimalDetails(animalId);
          }
        }}
      />
    </div>
  );
};

export default FarmDashboard;
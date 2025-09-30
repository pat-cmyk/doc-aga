import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Milk, Activity, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line, ComposedChart, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HealthEventsDialog from "./HealthEventsDialog";
import { calculateLifeStage, calculateMilkingStage, type AnimalStageData } from "@/lib/animalStages";

interface FarmDashboardProps {
  farmId: string;
  onNavigateToAnimals?: () => void;
  onNavigateToAnimalDetails?: (animalId: string) => void;
}

interface DashboardStats {
  totalAnimals: number;
  avgDailyMilk: number;
  pregnantCount: number;
  recentHealthEvents: number;
}

interface CombinedDailyData {
  date: string;
  milkTotal: number;
  [key: string]: string | number; // Dynamic stage counts
}

const FarmDashboard = ({ farmId, onNavigateToAnimals, onNavigateToAnimalDetails }: FarmDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    recentHealthEvents: 0
  });
  const [combinedData, setCombinedData] = useState<CombinedDailyData[]>([]);
  const [stageKeys, setStageKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"mtd" | "ytd">("mtd");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [farmId, timePeriod, selectedYear]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (timePeriod) {
      case "mtd": // Month to Date
        startDate = new Date(selectedYear, now.getMonth(), 1);
        // If selected year is current year, use today, otherwise use end of current month
        if (selectedYear === now.getFullYear() && now.getMonth() === now.getMonth()) {
          endDate = now;
        } else {
          endDate = new Date(selectedYear, now.getMonth() + 1, 0); // Last day of month
        }
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

      // Get pregnant animals (from AI records with pregnancy confirmed events)
      const { data: pregnancyData } = await supabase
        .from("animal_events")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("event_type", "pregnancy_confirmed");

      // Get recent health events
      const { count: healthCount } = await supabase
        .from("health_records")
        .select("*, animals!inner(farm_id)", { count: "exact", head: true })
        .eq("animals.farm_id", farmId)
        .gte("visit_date", startDate.toISOString().split("T")[0]);

      // Fetch pre-aggregated data from daily_farm_stats table
      const { data: dailyStats, error: statsError } = await supabase
        .from("daily_farm_stats")
        .select("*")
        .eq("farm_id", farmId)
        .gte("stat_date", startDate.toISOString().split("T")[0])
        .lte("stat_date", endDate.toISOString().split("T")[0])
        .order("stat_date", { ascending: true });

      if (statsError) {
        console.error("Error fetching daily stats:", statsError);
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

      // Calculate max cattle count for Y-axis scaling
      let maxCattleCount = 0;
      finalData.forEach(dataPoint => {
        stageKeysArray.forEach(stage => {
          const count = dataPoint[stage] as number || 0;
          if (count > maxCattleCount) maxCattleCount = count;
        });
      });

      setCombinedData(finalData);
      setStageKeys(stageKeysArray);

      setStats({
        totalAnimals: animalCount || 0,
        avgDailyMilk: Number(avgMilk.toFixed(2)),
        pregnantCount: pregnancyData?.length || 0,
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            Per animal ({timePeriod === "mtd" ? "MTD" : "YTD"} {selectedYear})
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
            {timePeriod === "mtd" ? `${new Date().toLocaleString('default', { month: 'short' })} ${selectedYear}` : `Year ${selectedYear}`}
          </p>
        </CardContent>
      </Card>
      </div>

      {/* Combined Milk Production & Cattle Count Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Daily Milk Production & Cattle Head Count by Stage</CardTitle>
            <div className="flex items-center gap-3">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as "mtd" | "ytd")} className="w-auto">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="mtd">MTD</TabsTrigger>
                  <TabsTrigger value="ytd">YTD</TabsTrigger>
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
                ...Object.fromEntries(
                  stageKeys.map((stage, idx) => {
                    const colors = [
                      "hsl(220, 70%, 60%)", // Blue
                      "hsl(160, 60%, 50%)", // Teal
                      "hsl(280, 65%, 60%)", // Purple
                      "hsl(30, 80%, 55%)",  // Orange
                      "hsl(340, 75%, 55%)", // Pink
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
              className="h-[400px] w-full"
            >
              <ComposedChart data={combinedData} margin={{ left: 20, right: 60, top: 20, bottom: 20 }}>
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
                  yAxisId="left"
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}L`}
                  label={{ value: "Milk (Liters)", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Cattle Count", angle: 90, position: "insideRight" }}
                  domain={[0, 'auto']}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="milkTotal"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#fillMilk)"
                  name="Milk (L)"
                />
                {stageKeys.map((stage, idx) => {
                  const colors = [
                    "hsl(220, 70%, 60%)", // Blue
                    "hsl(160, 60%, 50%)", // Teal
                    "hsl(280, 65%, 60%)", // Purple
                    "hsl(30, 80%, 55%)",  // Orange
                    "hsl(340, 75%, 55%)", // Pink
                  ];
                  return (
                    <Line
                      key={stage}
                      yAxisId="right"
                      type="monotone"
                      dataKey={stage}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
              </ComposedChart>
            </ChartContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Milk className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
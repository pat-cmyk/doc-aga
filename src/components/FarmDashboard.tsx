import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Milk, Activity, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, ComposedChart, Legend } from "recharts";
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
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [farmId]);

  const loadDashboardData = async () => {
    try {
      // Get total animals
      const { count: animalCount } = await supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      // Get average daily milk
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: milkingData } = await supabase
        .from("milking_records")
        .select("liters, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0]);

      const avgMilk = milkingData && milkingData.length > 0
        ? milkingData.reduce((sum, r) => sum + Number(r.liters), 0) / milkingData.length
        : 0;

      // Get pregnant animals (from AI records with pregnancy confirmed events)
      const { data: pregnancyData } = await supabase
        .from("animal_events")
        .select("animal_id, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .eq("event_type", "pregnancy_confirmed");

      // Get recent health events (last 30 days)
      const { count: healthCount } = await supabase
        .from("health_records")
        .select("*, animals!inner(farm_id)", { count: "exact", head: true })
        .eq("animals.farm_id", farmId)
        .gte("visit_date", thirtyDaysAgo.toISOString().split("T")[0]);

      // Get daily milk totals for chart (last 30 days)
      const { data: dailyMilk } = await supabase
        .from("milking_records")
        .select("record_date, liters, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("record_date", { ascending: true });

      // Get cattle data for stage calculations
      const { data: animals } = await supabase
        .from("animals")
        .select("id, birth_date, gender, milking_start_date, mother_id")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      // BATCH OPTIMIZATION: Fetch all required data upfront (4 queries instead of 900+)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      // Fetch all offspring for all animals in the farm
      const { data: allOffspring } = await supabase
        .from("animals")
        .select("id, mother_id, birth_date")
        .eq("farm_id", farmId)
        .not("mother_id", "is", null)
        .order("birth_date", { ascending: false });

      // Fetch all milking records for the last 60 days
      const { data: allMilkingRecords } = await supabase
        .from("milking_records")
        .select("animal_id, record_date, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId)
        .gte("record_date", sixtyDaysAgo.toISOString().split("T")[0]);

      // Fetch all AI records for all animals
      const { data: allAIRecords } = await supabase
        .from("ai_records")
        .select("animal_id, performed_date, scheduled_date, animals!inner(farm_id)")
        .eq("animals.farm_id", farmId);

      // Create Maps for fast in-memory lookups
      const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
      allOffspring?.forEach(offspring => {
        if (!offspring.mother_id) return;
        if (!offspringByMother.has(offspring.mother_id)) {
          offspringByMother.set(offspring.mother_id, []);
        }
        offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
      });

      const milkingByAnimal = new Map<string, Array<{ record_date: string }>>();
      allMilkingRecords?.forEach(record => {
        if (!milkingByAnimal.has(record.animal_id)) {
          milkingByAnimal.set(record.animal_id, []);
        }
        milkingByAnimal.get(record.animal_id)!.push({ record_date: record.record_date });
      });

      const aiByAnimal = new Map<string, Array<{ performed_date: string | null, scheduled_date: string | null }>>();
      allAIRecords?.forEach(record => {
        if (!aiByAnimal.has(record.animal_id)) {
          aiByAnimal.set(record.animal_id, []);
        }
        aiByAnimal.get(record.animal_id)!.push({
          performed_date: record.performed_date,
          scheduled_date: record.scheduled_date
        });
      });

      // Create array of last 30 days
      const dateArray: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dateArray.push(d.toISOString().split("T")[0]);
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

      // Add milk data
      dailyMilk?.forEach(record => {
        const date = record.record_date;
        if (combinedDataMap[date]) {
          combinedDataMap[date].milkTotal += Number(record.liters);
        }
      });

      // Calculate stage counts for each day using in-memory data
      if (animals) {
        for (const targetDate of dateArray) {
          const targetDateObj = new Date(targetDate);
          const stageCounts: Record<string, number> = {};

          for (const animal of animals) {
            if (animal.gender?.toLowerCase() !== "female") continue;
            if (!animal.birth_date) continue;

            const birthDate = new Date(animal.birth_date);

            // Get offspring data from Map (in-memory lookup)
            const offspring = offspringByMother.get(animal.id) || [];
            const offspringBeforeDate = offspring.filter(o => o.birth_date <= targetDate);
            const offspringCount = offspringBeforeDate.length;
            const lastCalvingDate = offspringBeforeDate[0]?.birth_date 
              ? new Date(offspringBeforeDate[0].birth_date) 
              : null;

            // Check for milking records from Map (in-memory lookup)
            const thirtyDaysBeforeTarget = new Date(targetDateObj);
            thirtyDaysBeforeTarget.setDate(thirtyDaysBeforeTarget.getDate() - 30);
            const thirtyDaysBeforeStr = thirtyDaysBeforeTarget.toISOString().split("T")[0];

            const animalMilkingRecords = milkingByAnimal.get(animal.id) || [];
            const hasRecentMilking = animalMilkingRecords.some(
              r => r.record_date >= thirtyDaysBeforeStr && r.record_date <= targetDate
            );

            // Check for AI records from Map (in-memory lookup)
            const animalAIRecords = aiByAnimal.get(animal.id) || [];
            const hasActiveAI = animalAIRecords.some(
              r => r.scheduled_date && r.scheduled_date <= targetDate
            ) && offspringCount === 0;

            const stageData: AnimalStageData = {
              birthDate: birthDate,
              gender: animal.gender,
              milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
              offspringCount: offspringCount,
              lastCalvingDate: lastCalvingDate,
              hasRecentMilking: hasRecentMilking,
              hasActiveAI: hasActiveAI,
            };

            const milkingStage = calculateMilkingStage(stageData);

            if (milkingStage) {
              stageCounts[milkingStage] = (stageCounts[milkingStage] || 0) + 1;
              allStageKeys.add(milkingStage);
            }
          }

          // Add stage counts to combined data
          Object.entries(stageCounts).forEach(([stage, count]) => {
            combinedDataMap[targetDate][stage] = count;
          });
        }
      }

      const finalData = dateArray.map(date => combinedDataMap[date]);
      const stageKeysArray = Array.from(allStageKeys);

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
          <p className="text-xs text-muted-foreground">Per animal (30 days)</p>
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
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>
      </div>

      {/* Combined Milk Production & Cattle Count Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Milk Production & Cattle Head Count by Stage</CardTitle>
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
              <ComposedChart data={combinedData} margin={{ left: 20, right: 60, top: 20, bottom: 20 }} barSize={20}>
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
                  domain={[0, 4]}
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
                    <Bar
                      key={stage}
                      yAxisId="right"
                      dataKey={stage}
                      stackId="stages"
                      fill={colors[idx % colors.length]}
                      radius={[2, 2, 0, 0]}
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
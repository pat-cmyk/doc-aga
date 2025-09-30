import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Milk, Activity, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, Legend } from "recharts";
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

interface DailyMilkData {
  date: string;
  total: number;
}

interface StageCountData {
  stage: string;
  count: number;
  type: "Life Stage" | "Milking Stage";
}

const FarmDashboard = ({ farmId, onNavigateToAnimals, onNavigateToAnimalDetails }: FarmDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    recentHealthEvents: 0
  });
  const [dailyMilkData, setDailyMilkData] = useState<DailyMilkData[]>([]);
  const [stageData, setStageData] = useState<StageCountData[]>([]);
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

      // Group by date and sum liters
      const milkByDate = dailyMilk?.reduce((acc, record) => {
        const date = record.record_date;
        if (!acc[date]) {
          acc[date] = 0;
        }
        acc[date] += Number(record.liters);
        return acc;
      }, {} as Record<string, number>) || {};

      const chartData = Object.entries(milkByDate).map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total: Number(total.toFixed(2))
      }));

      // Get cattle counts by stage
      const { data: animals } = await supabase
        .from("animals")
        .select("id, birth_date, gender, milking_start_date, mother_id")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      const stageCounts: Record<string, number> = {};
      const milkingStageCounts: Record<string, number> = {};

      if (animals) {
        for (const animal of animals) {
          if (animal.gender?.toLowerCase() !== "female") continue;

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

          // Check for recent milking records
          const { data: recentMilking } = await supabase
            .from("milking_records")
            .select("id")
            .eq("animal_id", animal.id)
            .gte("record_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          // Check for active AI records
          const { data: aiRecords } = await supabase
            .from("ai_records")
            .select("performed_date")
            .eq("animal_id", animal.id)
            .order("scheduled_date", { ascending: false })
            .limit(1);

          const stageData: AnimalStageData = {
            birthDate: animal.birth_date ? new Date(animal.birth_date) : null,
            gender: animal.gender,
            milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
            offspringCount: offspringCount || 0,
            lastCalvingDate: offspring?.[0]?.birth_date ? new Date(offspring[0].birth_date) : null,
            hasRecentMilking: (recentMilking?.length || 0) > 0,
            hasActiveAI: (aiRecords?.length || 0) > 0 && !offspringCount,
          };

          const lifeStage = calculateLifeStage(stageData);
          const milkingStage = calculateMilkingStage(stageData);

          if (lifeStage) {
            stageCounts[lifeStage] = (stageCounts[lifeStage] || 0) + 1;
          }
          if (milkingStage) {
            milkingStageCounts[milkingStage] = (milkingStageCounts[milkingStage] || 0) + 1;
          }
        }
      }

      // Convert to chart data format
      const lifeStageData: StageCountData[] = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        count,
        type: "Life Stage" as const
      }));

      const milkingStageDataArr: StageCountData[] = Object.entries(milkingStageCounts).map(([stage, count]) => ({
        stage,
        count,
        type: "Milking Stage" as const
      }));

      setStageData([...lifeStageData, ...milkingStageDataArr]);

      setStats({
        totalAnimals: animalCount || 0,
        avgDailyMilk: Number(avgMilk.toFixed(2)),
        pregnantCount: pregnancyData?.length || 0,
        recentHealthEvents: healthCount || 0
      });
      setDailyMilkData(chartData);
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

      {/* Daily Milk Production Chart */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Milk Production</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyMilkData.length > 0 ? (
              <ChartContainer
                config={{
                  total: {
                    label: "Total Liters",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px] w-full"
              >
                <AreaChart data={dailyMilkData}>
                  <defs>
                    <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#fillTotal)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Milk className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No milking records yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cattle by Stage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cattle Head Count by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageData.length > 0 ? (
              <ChartContainer
                config={{
                  lifeStage: {
                    label: "Life Stage",
                    color: "hsl(var(--primary))",
                  },
                  milkingStage: {
                    label: "Milking Stage",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-[300px] w-full"
              >
                <BarChart 
                  data={stageData}
                  layout="vertical"
                  margin={{ left: 100, right: 20, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis 
                    dataKey="stage" 
                    type="category" 
                    className="text-xs"
                    width={90}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No stage data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
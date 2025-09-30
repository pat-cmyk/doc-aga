import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Milk, Activity, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface FarmDashboardProps {
  farmId: string;
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

const FarmDashboard = ({ farmId }: FarmDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    recentHealthEvents: 0
  });
  const [dailyMilkData, setDailyMilkData] = useState<DailyMilkData[]>([]);
  const [loading, setLoading] = useState(true);
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
        <Card>
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

      <Card>
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
    </div>
  );
};

export default FarmDashboard;
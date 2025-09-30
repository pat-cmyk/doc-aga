import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Milk, Activity, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FarmDashboardProps {
  farmId: string;
}

interface DashboardStats {
  totalAnimals: number;
  avgDailyMilk: number;
  pregnantCount: number;
  recentHealthEvents: number;
}

const FarmDashboard = ({ farmId }: FarmDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnimals: 0,
    avgDailyMilk: 0,
    pregnantCount: 0,
    recentHealthEvents: 0
  });
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
  );
};

export default FarmDashboard;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Milk, TrendingUp, Calendar } from "lucide-react";
import type { DashboardStats as StatsType } from "./hooks/useDashboardStats";

interface DashboardStatsProps {
  stats: StatsType;
}

/**
 * Dashboard statistics cards showing key farm metrics
 */
export const DashboardStats = ({ stats }: DashboardStatsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAnimals}</div>
        </CardContent>
      </Card>
      
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Daily Milk</CardTitle>
          <Milk className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgDailyMilk.toFixed(1)}L</div>
        </CardContent>
      </Card>
      
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pregnant</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pregnantCount}</div>
          {stats.pendingConfirmation > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.pendingConfirmation} pending confirmation
            </p>
          )}
        </CardContent>
      </Card>
      
      <Card className="min-h-[120px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Health Events</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.recentHealthEvents}</div>
        </CardContent>
      </Card>
    </div>
  );
};

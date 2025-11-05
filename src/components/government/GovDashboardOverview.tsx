import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { GovStatsWithGrowth } from "@/hooks/useGovernmentStats";
import { Skeleton } from "@/components/ui/skeleton";

interface GovDashboardOverviewProps {
  stats?: GovStatsWithGrowth;
  isLoading: boolean;
  error?: Error | null;
}

export const GovDashboardOverview = ({ stats, isLoading, error }: GovDashboardOverviewProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load government statistics. Please refresh the page or contact support.</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">No data available</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const GrowthIndicator = ({ value }: { value: number }) => {
    if (value > 0) {
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-500" />
          +{value}% from previous period
        </p>
      );
    } else if (value < 0) {
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-red-500" />
          {value}% from previous period
        </p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground">No change from previous period</p>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Farms</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.farm_count.toLocaleString()}</div>
          <GrowthIndicator value={stats.farmGrowth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Animals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.active_animal_count.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Registered in the system
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Logs</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.daily_log_count.toLocaleString()}
          </div>
          <GrowthIndicator value={stats.logGrowth} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Health Events</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.health_event_count.toLocaleString()}
          </div>
          <GrowthIndicator value={stats.healthGrowth} />
        </CardContent>
      </Card>
    </div>
  );
};

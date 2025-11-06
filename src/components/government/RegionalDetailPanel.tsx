import { useMemo } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGovernmentStats,
  useGovernmentStatsTimeseries,
  useHealthHeatmap,
} from "@/hooks/useGovernmentStats";
import { TrendingUp, TrendingDown, Users, Building2, Activity, Milk } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RegionalDetailPanelProps {
  region: string | null;
  isOpen: boolean;
  onClose: () => void;
  dateRange: { start: Date; end: Date };
}

const RegionalDetailPanel = ({
  region,
  isOpen,
  onClose,
  dateRange,
}: RegionalDetailPanelProps) => {
  const daysDiff = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: stats, isLoading: statsLoading } = useGovernmentStats(
    dateRange.start,
    dateRange.end,
    region || undefined,
    { enabled: isOpen && !!region }
  );

  const { data: timeseriesData, isLoading: timeseriesLoading } =
    useGovernmentStatsTimeseries(
      dateRange.start,
      dateRange.end,
      region || undefined,
      { enabled: isOpen && !!region }
    );

  const { data: heatmapData, isLoading: heatmapLoading } = useHealthHeatmap(
    daysDiff,
    region || undefined,
    { enabled: isOpen && !!region }
  );

  const chartData = useMemo(() => {
    if (!timeseriesData) return [];
    return timeseriesData.map((d) => ({
      date: format(new Date(d.date), "MMM d"),
      farms: d.farm_count,
      animals: d.active_animal_count,
      healthEvents: d.health_event_count,
      avgMilk: d.avg_milk_liters,
    }));
  }, [timeseriesData]);

  const topMunicipalities = useMemo(() => {
    if (!heatmapData) return [];
    return heatmapData
      .sort((a, b) => (b.prevalence_rate || 0) - (a.prevalence_rate || 0))
      .slice(0, 5);
  }, [heatmapData]);

  const GrowthIndicator = ({ value }: { value?: number }) => {
    if (!value || value === 0) return null;
    const isPositive = value > 0;
    return (
      <Badge
        variant={isPositive ? "default" : "secondary"}
        className="gap-1"
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {Math.abs(value).toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetTitle className="text-2xl">{region}</SheetTitle>
              <SheetDescription>
                Regional statistics from {format(dateRange.start, "MMM d, yyyy")} to{" "}
                {format(dateRange.end, "MMM d, yyyy")}
              </SheetDescription>
            </SheetHeader>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Active Farms
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">
                        {stats?.farm_count || 0}
                      </p>
                      <GrowthIndicator value={stats?.farmGrowth} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Active Animals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stats?.active_animal_count?.toLocaleString() || 0}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Health Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">
                        {stats?.health_event_count || 0}
                      </p>
                      <GrowthIndicator value={stats?.healthGrowth} />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Milk className="h-4 w-4 text-muted-foreground" />
                    Avg. Milk/Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {stats?.avg_milk_liters?.toFixed(1) || "0.0"}L
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Trend Charts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Population Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {timeseriesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="farms"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        name="Farms"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="animals"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        name="Animals"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No trend data available
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Health & Production</CardTitle>
              </CardHeader>
              <CardContent>
                {timeseriesLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="healthEvents"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        name="Health Events"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgMilk"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        name="Avg Milk (L)"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No trend data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Health Hotspots */}
            {topMunicipalities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Health Hotspots</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Top municipalities by health event rate
                  </p>
                </CardHeader>
                <CardContent>
                  {heatmapLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topMunicipalities.map((muni) => (
                        <div
                          key={muni.municipality}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{muni.municipality}</p>
                            <p className="text-xs text-muted-foreground">
                              {muni.symptom_types?.[0] || "Various symptoms"}
                            </p>
                          </div>
                          <Badge variant="destructive">
                            {muni.prevalence_rate?.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default RegionalDetailPanel;

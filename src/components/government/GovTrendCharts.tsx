import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeseriesDataPoint } from "@/hooks/useGovernmentStats";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, Activity, Layers } from "lucide-react";
import { formatNumber } from "@/lib/currency";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface GovTrendChartsProps {
  data?: TimeseriesDataPoint[];
  comparisonData?: TimeseriesDataPoint[];
  isLoading: boolean;
  error?: Error | null;
  comparisonMode?: boolean;
}

export const GovTrendCharts = ({ data, comparisonData, isLoading, error, comparisonMode }: GovTrendChartsProps) => {
  const { isMobile, fontSize, xAxisProps, legendProps } = useResponsiveChart({
    size: 'medium',
    dataLength: data?.length || 0
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
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
          <p className="text-destructive">Failed to load trend data. Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No trend data available for the selected date range.</p>
        </CardContent>
      </Card>
    );
  }

  // Transform data - now pre-aggregated from RPC
  const chartData = data.map(point => ({
    date: format(parseISO(point.date), "MMM dd"),
    fullDate: format(parseISO(point.date), "PPP"),
    farms: Number(point.total_farms),
    cattle_count: Number(point.cattle_count),
    goat_count: Number(point.goat_count),
    carabao_count: Number(point.carabao_count),
    sheep_count: Number(point.sheep_count),
    healthEvents: Number(point.health_events),
    queries: Number(point.doc_aga_queries),
    totalMilk: Number(point.total_milk_liters),
  }));

  // Format comparison data if available
  const comparisonChartData = comparisonMode && comparisonData ? comparisonData.map(point => ({
    date: format(parseISO(point.date), "MMM dd"),
    fullDate: format(parseISO(point.date), "PPP"),
    comparisonFarms: Number(point.total_farms),
    comparison_cattle_count: Number(point.cattle_count),
    comparison_goat_count: Number(point.goat_count),
    comparison_carabao_count: Number(point.carabao_count),
    comparison_sheep_count: Number(point.sheep_count),
    comparisonHealthEvents: Number(point.health_events),
    comparisonQueries: Number(point.doc_aga_queries),
    comparisonTotalMilk: Number(point.total_milk_liters),
  })) : [];

  // Merge data for display when in comparison mode
  const mergedChartData = comparisonMode && comparisonChartData.length > 0
    ? chartData.map((primary, index) => ({
        ...primary,
        ...(comparisonChartData[index] || {}),
      }))
    : chartData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold mb-2">{payload[0]?.payload?.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? formatNumber(entry.value) : entry.value}
              {entry.dataKey === 'totalMilk' || entry.dataKey === 'comparisonTotalMilk' ? 'L' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Farm Growth Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Farm Growth Trend</CardTitle>
          </div>
          <CardDescription>Number of active farms over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <AreaChart data={mergedChartData}>
              <defs>
                <linearGradient id="farmGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="farmGrowthComparisonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
                angle={xAxisProps.angle}
                textAnchor={xAxisProps.textAnchor}
                height={xAxisProps.height}
                tickMargin={xAxisProps.tickMargin}
                interval={xAxisProps.interval}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={legendProps.wrapperStyle}
                iconSize={legendProps.iconSize}
              />
              <Area
                type="monotone"
                dataKey="farms"
                stroke="hsl(var(--primary))"
                fill="url(#farmGrowthGradient)"
                strokeWidth={2}
                name="Primary Farms"
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
              {comparisonMode && (
                <Area
                  type="monotone"
                  dataKey="comparisonFarms"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#farmGrowthComparisonGradient)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Comparison Farms"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--chart-1))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Livestock Composition Stacked Area Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle>Livestock Composition Trend</CardTitle>
          </div>
          <CardDescription>Stacked view of animal population by type over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <AreaChart data={mergedChartData}>
              <defs>
                <linearGradient id="livestockCattle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="livestockGoat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="livestockCarabao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="livestockSheep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
                angle={xAxisProps.angle}
                textAnchor={xAxisProps.textAnchor}
                height={xAxisProps.height}
                tickMargin={xAxisProps.tickMargin}
                interval={xAxisProps.interval}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <p className="font-semibold mb-2">{payload[0]?.payload?.fullDate}</p>
                        <p className="text-sm font-medium text-foreground mb-1">Total: {total.toLocaleString()} animals</p>
                        {payload.map((entry: any, index: number) => {
                          const percentage = total > 0 ? ((Number(entry.value) / total) * 100).toFixed(1) : '0';
                          return (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                              {entry.name}: {Number(entry.value).toLocaleString()} ({percentage}%)
                            </p>
                          );
                        })}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={legendProps.wrapperStyle}
                iconSize={legendProps.iconSize}
              />
              <Area
                type="monotone"
                dataKey="cattle_count"
                stackId="1"
                stroke="hsl(var(--chart-1))"
                fill="url(#livestockCattle)"
                strokeWidth={1.5}
                name="Cattle"
              />
              <Area
                type="monotone"
                dataKey="goat_count"
                stackId="1"
                stroke="hsl(var(--chart-2))"
                fill="url(#livestockGoat)"
                strokeWidth={1.5}
                name="Goat"
              />
              <Area
                type="monotone"
                dataKey="carabao_count"
                stackId="1"
                stroke="hsl(var(--chart-3))"
                fill="url(#livestockCarabao)"
                strokeWidth={1.5}
                name="Carabao"
              />
              <Area
                type="monotone"
                dataKey="sheep_count"
                stackId="1"
                stroke="hsl(var(--chart-4))"
                fill="url(#livestockSheep)"
                strokeWidth={1.5}
                name="Sheep"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Health Events Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Health Events Trend</CardTitle>
          </div>
          <CardDescription>Daily health events over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <AreaChart data={mergedChartData}>
              <defs>
                <linearGradient id="healthEventsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="healthEventsComparisonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
                angle={xAxisProps.angle}
                textAnchor={xAxisProps.textAnchor}
                height={xAxisProps.height}
                tickMargin={xAxisProps.tickMargin}
                interval={xAxisProps.interval}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={legendProps.wrapperStyle}
                iconSize={legendProps.iconSize}
              />
              <Area
                type="monotone"
                dataKey="healthEvents"
                stroke="hsl(var(--chart-3))"
                fill="url(#healthEventsGradient)"
                strokeWidth={2}
                name="Health Events"
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(var(--chart-3))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
              {comparisonMode && (
                <Area
                  type="monotone"
                  dataKey="comparisonHealthEvents"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#healthEventsComparisonGradient)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Comparison Health Events"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--chart-1))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

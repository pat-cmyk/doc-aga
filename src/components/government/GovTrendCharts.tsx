import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeseriesDataPoint } from "@/hooks/useGovernmentStats";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, Activity, FileText, Droplets } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface GovTrendChartsProps {
  data?: TimeseriesDataPoint[];
  comparisonData?: TimeseriesDataPoint[];
  isLoading: boolean;
  error?: Error | null;
  comparisonMode?: boolean;
}

export const GovTrendCharts = ({ data, comparisonData, isLoading, error, comparisonMode }: GovTrendChartsProps) => {
  const isMobile = useIsMobile();
  
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
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

  // Define colors for each livestock type
  const livestockColors: Record<string, string> = {
    cattle: "hsl(var(--chart-1))",
    goat: "hsl(var(--chart-2))",
    carabao: "hsl(var(--chart-3))",
    sheep: "hsl(var(--chart-4))",
  };

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

  // Livestock types available in the new format
  const livestockTypes = ['cattle', 'goat', 'carabao', 'sheep'];
  const milkProducingTypes = ['cattle', 'goat', 'carabao'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold mb-2">{payload[0]?.payload?.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              {entry.dataKey === 'totalMilk' || entry.dataKey === 'comparisonTotalMilk' ? 'L' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
            <LineChart data={mergedChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconSize={10}
              />
              <Line 
                type="monotone" 
                dataKey="farms" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Primary Farms"
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              {comparisonMode && (
                <Line 
                  type="monotone" 
                  dataKey="comparisonFarms" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Comparison Farms"
                  dot={{ fill: 'hsl(var(--chart-1))' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Animal Count Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Animal Population by Type</CardTitle>
          </div>
          <CardDescription>Number of active animals by livestock type over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <LineChart data={mergedChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconSize={10}
              />
              {/* Render a line for each livestock type */}
              {livestockTypes.map((type) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={`${type}_count`}
                  stroke={livestockColors[type]}
                  strokeWidth={2}
                  name={type.charAt(0).toUpperCase() + type.slice(1)}
                  dot={{ fill: livestockColors[type] }}
                  connectNulls
                />
              ))}
              {comparisonMode && livestockTypes.map((type) => (
                <Line
                  key={`comparison_${type}`}
                  type="monotone"
                  dataKey={`comparison_${type}_count`}
                  stroke={livestockColors[type]}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`Comparison ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                  dot={{ fill: livestockColors[type] }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Health Events Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Health Events & Queries</CardTitle>
          </div>
          <CardDescription>Daily health events and Doc Aga queries</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <LineChart data={mergedChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconSize={10}
              />
              <Line 
                type="monotone" 
                dataKey="healthEvents" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                name="Primary Health Events"
                dot={{ fill: 'hsl(var(--chart-3))' }}
              />
              <Line 
                type="monotone" 
                dataKey="queries" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                name="Primary Queries"
                dot={{ fill: 'hsl(var(--chart-4))' }}
              />
              {comparisonMode && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="comparisonHealthEvents" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Comparison Health Events"
                    dot={{ fill: 'hsl(var(--chart-1))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="comparisonQueries" 
                    stroke="hsl(var(--chart-5))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Comparison Queries"
                    dot={{ fill: 'hsl(var(--chart-5))' }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Milk Production Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle>Total Milk Production</CardTitle>
          </div>
          <CardDescription>Daily total milk production in liters</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <LineChart data={mergedChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconSize={10}
              />
              <Line 
                type="monotone" 
                dataKey="totalMilk" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Total Milk (L)"
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              {comparisonMode && (
                <Line 
                  type="monotone" 
                  dataKey="comparisonTotalMilk" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Comparison Total Milk (L)"
                  dot={{ fill: 'hsl(var(--chart-1))' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
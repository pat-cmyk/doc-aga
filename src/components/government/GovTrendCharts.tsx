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

  // Get unique livestock types
  const livestockTypes = [...new Set(data.map(d => d.livestock_type))];

  // Define colors for each livestock type
  const livestockColors: Record<string, string> = {
    cattle: "hsl(var(--chart-1))",
    goat: "hsl(var(--chart-2))",
    carabao: "hsl(var(--chart-3))",
    sheep: "hsl(var(--chart-4))",
  };

  // Transform data to have one object per date with fields for each livestock type
  const chartDataMap = data.reduce((acc, point) => {
    const date = format(parseISO(point.date), "MMM dd");
    const fullDate = format(parseISO(point.date), "PPP");
    
    if (!acc[date]) {
      acc[date] = { date, fullDate, farms: 0, healthEvents: 0, queries: 0 };
    }
    
    // Add livestock-specific data
    acc[date][`${point.livestock_type}_count`] = Number(point.active_animal_count);
    acc[date][`${point.livestock_type}_milk`] = Number(point.avg_milk_liters);
    
    // Aggregate farm counts (same across livestock types for a date)
    acc[date].farms = Number(point.farm_count);
    acc[date].healthEvents += Number(point.health_event_count);
    acc[date].queries += Number(point.doc_aga_query_count);
    
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(chartDataMap);

  // Format comparison data if available
  const comparisonTypes = comparisonMode && comparisonData ? [...new Set(comparisonData.map(d => d.livestock_type))] : [];
  
  const comparisonChartDataMap = comparisonMode && comparisonData ? comparisonData.reduce((acc, point) => {
    const date = format(parseISO(point.date), "MMM dd");
    const fullDate = format(parseISO(point.date), "PPP");
    
    if (!acc[date]) {
      acc[date] = { date, fullDate, comparisonFarms: 0, comparisonHealthEvents: 0, comparisonQueries: 0 };
    }
    
    // Add livestock-specific comparison data
    acc[date][`comparison_${point.livestock_type}_count`] = Number(point.active_animal_count);
    acc[date][`comparison_${point.livestock_type}_milk`] = Number(point.avg_milk_liters);
    
    // Aggregate comparison farm counts
    acc[date].comparisonFarms = Number(point.farm_count);
    acc[date].comparisonHealthEvents += Number(point.health_event_count);
    acc[date].comparisonQueries += Number(point.doc_aga_query_count);
    
    return acc;
  }, {} as Record<string, any>) : {};

  const comparisonChartData = Object.values(comparisonChartDataMap);

  // Merge data for display when in comparison mode
  const mergedChartData = comparisonMode && comparisonChartData.length > 0
    ? chartData.map((primary, index) => ({
        ...primary,
        ...(comparisonChartData[index] || {}),
      }))
    : chartData;

  // Filter to only milk-producing livestock
  const milkProducingTypes = livestockTypes.filter(type => ['cattle', 'goat', 'carabao'].includes(type));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Group by livestock type for cleaner display
      const livestockData: Record<string, any> = {};
      let otherData: any[] = [];
      
      payload.forEach((entry: any) => {
        const countMatch = entry.dataKey.match(/^(comparison_)?(.+)_count$/);
        const milkMatch = entry.dataKey.match(/^(comparison_)?(.+)_milk$/);
        
        if (countMatch) {
          const [, prefix, livestock] = countMatch;
          const key = prefix ? `${prefix}${livestock}` : livestock;
          if (!livestockData[key]) {
            livestockData[key] = { prefix, livestock };
          }
          livestockData[key].count = entry.value;
          livestockData[key].color = entry.color;
        } else if (milkMatch) {
          const [, prefix, livestock] = milkMatch;
          const key = prefix ? `${prefix}${livestock}` : livestock;
          if (!livestockData[key]) {
            livestockData[key] = { prefix, livestock };
          }
          livestockData[key].milk = entry.value;
        } else {
          otherData.push(entry);
        }
      });
      
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold mb-2">{payload[0]?.payload?.fullDate}</p>
          {Object.entries(livestockData).map(([key, data]: [string, any]) => (
            <div key={key} className="text-sm mb-1">
              <span style={{ color: data.color }} className="font-medium">
                {data.prefix ? 'Comparison ' : ''}{data.livestock.charAt(0).toUpperCase() + data.livestock.slice(1)}:
              </span>
              {data.count !== undefined && <span> {data.count} animals</span>}
              {data.milk !== undefined && <span>, {Number(data.milk).toFixed(2)}L milk</span>}
            </div>
          ))}
          {otherData.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
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
              {/* Dynamically render a line for each livestock type */}
              {livestockTypes.map((type, index) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={`${type}_count`}
                  stroke={livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  strokeWidth={2}
                  name={type.charAt(0).toUpperCase() + type.slice(1)}
                  dot={{ fill: livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))` }}
                  connectNulls
                />
              ))}
              {comparisonMode && comparisonTypes.map((type, index) => (
                <Line
                  key={`comparison_${type}`}
                  type="monotone"
                  dataKey={`comparison_${type}_count`}
                  stroke={livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`Comparison ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                  dot={{ fill: livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))` }}
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
            <CardTitle>Milk Production by Type</CardTitle>
          </div>
          <CardDescription>Daily average milk production by livestock type in liters</CardDescription>
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
              {/* Only show milk-producing livestock */}
              {milkProducingTypes.map((type, index) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={`${type}_milk`}
                  stroke={livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  strokeWidth={2}
                  name={`${type.charAt(0).toUpperCase() + type.slice(1)} Milk (L)`}
                  dot={{ fill: livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))` }}
                  connectNulls
                />
              ))}
              {comparisonMode && comparisonTypes.filter(type => ['cattle', 'goat', 'carabao'].includes(type)).map((type, index) => (
                <Line
                  key={`comparison_${type}`}
                  type="monotone"
                  dataKey={`comparison_${type}_milk`}
                  stroke={livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={`Comparison ${type.charAt(0).toUpperCase() + type.slice(1)} Milk (L)`}
                  dot={{ fill: livestockColors[type] || `hsl(var(--chart-${(index % 5) + 1}))` }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
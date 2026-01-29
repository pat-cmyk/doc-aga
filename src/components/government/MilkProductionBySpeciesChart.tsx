import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGovernmentMilkAnalytics } from "@/hooks/useGovernmentMilkAnalytics";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { formatPHPCompact } from "@/lib/currency";

interface MilkProductionBySpeciesChartProps {
  startDate: Date;
  endDate: Date;
  region?: string;
  province?: string;
  municipality?: string;
}

export const MilkProductionBySpeciesChart = ({
  startDate,
  endDate,
  region,
  province,
  municipality,
}: MilkProductionBySpeciesChartProps) => {
  const { data, isLoading, error } = useGovernmentMilkAnalytics(
    startDate,
    endDate,
    region,
    province,
    municipality
  );

  const { isMobile, fontSize, xAxisProps, legendProps } = useResponsiveChart({
    size: "medium",
    dataLength: data?.dataPoints?.length || 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load milk production data.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.dataPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle>Milk Production by Species</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No milk production data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.dataPoints.map((point) => ({
    date: format(parseISO(point.report_date), "MMM dd"),
    fullDate: format(parseISO(point.report_date), "PPP"),
    Cattle: point.cattle_milk_liters,
    Goat: point.goat_milk_liters,
    Carabao: point.carabao_milk_liters,
  }));

  // Calculate percentages
  const cattlePercent = data.totalMilk > 0 ? ((data.totalCattleMilk / data.totalMilk) * 100).toFixed(1) : "0";
  const goatPercent = data.totalMilk > 0 ? ((data.totalGoatMilk / data.totalMilk) * 100).toFixed(1) : "0";
  const carabaoPercent = data.totalMilk > 0 ? ((data.totalCarabaoMilk / data.totalMilk) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Milk</div>
            <div className="text-2xl font-bold">{data.totalMilk.toLocaleString()}L</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-chart-1" />
              Cattle ({cattlePercent}%)
            </div>
            <div className="text-xl font-semibold">{data.totalCattleMilk.toLocaleString()}L</div>
            {data.avgCattlePrice && (
              <div className="text-xs text-muted-foreground">~₱{data.avgCattlePrice.toFixed(0)}/L</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-chart-2" />
              Goat ({goatPercent}%)
            </div>
            <div className="text-xl font-semibold">{data.totalGoatMilk.toLocaleString()}L</div>
            {data.avgGoatPrice && (
              <div className="text-xs text-muted-foreground">~₱{data.avgGoatPrice.toFixed(0)}/L</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-chart-3" />
              Carabao ({carabaoPercent}%)
            </div>
            <div className="text-xl font-semibold">{data.totalCarabaoMilk.toLocaleString()}L</div>
            {data.avgCarabaoPrice && (
              <div className="text-xs text-muted-foreground">~₱{data.avgCarabaoPrice.toFixed(0)}/L</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Estimate Card */}
      {data.totalRevenueEstimate > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Estimated Milk Revenue (Period)
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatPHPCompact(data.totalRevenueEstimate)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Cattle: {formatPHPCompact(data.cattleRevenueEstimate)} | 
              Goat: {formatPHPCompact(data.goatRevenueEstimate)} | 
              Carabao: {formatPHPCompact(data.carabaoRevenueEstimate)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle>Milk Production by Species</CardTitle>
          </div>
          <CardDescription>
            Daily milk production breakdown by livestock type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 350}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize }}
                angle={xAxisProps.angle}
                textAnchor={xAxisProps.textAnchor}
                height={xAxisProps.height}
                tickMargin={xAxisProps.tickMargin}
                interval={xAxisProps.interval}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize }}
                tickFormatter={(value) => `${value}L`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <p className="font-semibold mb-2">{payload[0]?.payload?.fullDate}</p>
                        <p className="text-sm font-medium mb-1">Total: {total.toLocaleString()}L</p>
                        {payload.map((entry: any, index: number) => (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {Number(entry.value).toLocaleString()}L
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={legendProps.wrapperStyle} iconSize={legendProps.iconSize} />
              <Area
                type="monotone"
                dataKey="Cattle"
                stackId="1"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="Goat"
                stackId="1"
                stroke="hsl(var(--chart-2))"
                fill="hsl(var(--chart-2))"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="Carabao"
                stackId="1"
                stroke="hsl(var(--chart-3))"
                fill="hsl(var(--chart-3))"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ReferenceLine } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MilkChartTooltip } from "./MilkChartTooltip";
import { MilkDayDetailDialog } from "./MilkDayDetailDialog";
import type { CombinedDailyData } from "./hooks/useMilkData";
import { 
  ResponsiveChartContainer, 
  useResponsiveChartContext,
  ResponsiveXAxis,
  ResponsiveYAxis,
  ConditionalBrush 
} from "@/components/charts";

interface MilkProductionChartProps {
  data: CombinedDailyData[];
  timePeriod: "last30" | "ytd";
  selectedYear: number;
  onTimePeriodChange: (period: "last30" | "ytd") => void;
  onYearChange: (year: number) => void;
  farmId: string;
  averageMilk?: number;
}

interface MilkChartContentProps {
  data: CombinedDailyData[];
  averageMilk: number;
  highestDay: CombinedDailyData | null;
  lowestDay: CombinedDailyData | null;
  onChartClick: (chartData: any) => void;
}

/**
 * Inner chart content component that uses responsive context
 */
const MilkChartContent = ({ 
  data, 
  averageMilk, 
  highestDay, 
  lowestDay, 
  onChartClick 
}: MilkChartContentProps) => {
  const { isMobile, margin } = useResponsiveChartContext();

  // Custom active dot with animation
  const renderActiveDot = (props: any) => {
    const { cx, cy } = props;
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="hsl(var(--chart-1))"
          fillOpacity={0.3}
          className="animate-pulse"
        />
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="hsl(var(--chart-1))"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
      </g>
    );
  };

  // Custom dot to highlight extremes
  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    if (highestDay && payload.rawDate === highestDay.rawDate) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="hsl(var(--chart-2))"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
      );
    }
    
    if (lowestDay && payload.rawDate === lowestDay.rawDate && payload.milkTotal > 0) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="hsl(var(--destructive))"
          stroke="hsl(var(--background))"
          strokeWidth={2}
        />
      );
    }
    
    return null;
  };

  return (
    <AreaChart 
      data={data} 
      margin={{ ...margin, bottom: isMobile ? 80 : 50 }}
      onClick={onChartClick}
      style={{ cursor: 'pointer' }}
    >
      <defs>
        <linearGradient id="milkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
      <ResponsiveXAxis dataKey="date" />
      <ResponsiveYAxis 
        tickFormatter={(v) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : `${v}`)}
      />
      <ChartTooltip content={<MilkChartTooltip />} />
      
      {/* Average reference line */}
      {averageMilk > 0 && (
        <ReferenceLine
          y={averageMilk}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="5 5"
          strokeOpacity={0.5}
          label={{
            value: `Avg: ${averageMilk.toFixed(0)}L`,
            position: 'right',
            fontSize: isMobile ? 8 : 10,
            fill: 'hsl(var(--muted-foreground))',
          }}
        />
      )}
      
      <Area
        type="monotone"
        dataKey="milkTotal"
        name="Milk (Liters)"
        stroke="hsl(var(--chart-1))"
        fill="url(#milkGradient)"
        strokeWidth={2}
        dot={renderDot}
        activeDot={renderActiveDot}
      />
      
      <ConditionalBrush dataKey="date" />
    </AreaChart>
  );
};

/**
 * Interactive chart component displaying daily milk production over time
 * Features: custom tooltip, clickable data points, zoom/pan brush, reference lines
 */
export const MilkProductionChart = ({
  data,
  timePeriod,
  selectedYear,
  onTimePeriodChange,
  onYearChange,
  farmId,
  averageMilk = 0,
}: MilkProductionChartProps) => {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Find min/max dates for navigation
  const { minDate, maxDate, highestDay, lowestDay } = useMemo(() => {
    if (!data?.length) return { minDate: undefined, maxDate: undefined, highestDay: null, lowestDay: null };
    
    const validData = data.filter(d => d.rawDate);
    const dates = validData.map(d => d.rawDate);
    const milkValues = validData.filter(d => d.milkTotal > 0);
    
    let highest = null;
    let lowest = null;
    
    if (milkValues.length > 0) {
      highest = milkValues.reduce((max, d) => d.milkTotal > max.milkTotal ? d : max, milkValues[0]);
      lowest = milkValues.reduce((min, d) => d.milkTotal < min.milkTotal ? d : min, milkValues[0]);
    }
    
    return {
      minDate: dates.length > 0 ? dates.sort()[0] : undefined,
      maxDate: dates.length > 0 ? dates.sort().pop() : undefined,
      highestDay: highest,
      lowestDay: lowest,
    };
  }, [data]);

  const handleChartClick = (chartData: any) => {
    if (chartData?.activePayload?.[0]?.payload?.rawDate) {
      setSelectedDate(chartData.activePayload[0].payload.rawDate);
      setDialogOpen(true);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const chartConfig = {
    milkTotal: {
      label: "Milk (Liters)",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Daily Milk Production</CardTitle>
              <CardDescription>
                Liters of milk produced daily
                {averageMilk > 0 && (
                  <span className="ml-2 text-chart-1">
                    (Avg: {averageMilk.toFixed(1)}L)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Tabs value={timePeriod} onValueChange={(v) => onTimePeriodChange(v as "last30" | "ytd")}>
                <TabsList>
                  <TabsTrigger value="last30">Last 30 Days</TabsTrigger>
                  <TabsTrigger value="ytd">Year to Date</TabsTrigger>
                </TabsList>
              </Tabs>
              {timePeriod === "ytd" && (
                <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.length ? (
            <div className="h-[280px] sm:h-[320px] md:h-[360px] flex items-center justify-center text-muted-foreground">
              No data for selected period
            </div>
          ) : (
            <ResponsiveChartContainer
              config={chartConfig}
              size="medium"
              dataLength={data.length}
              brushThreshold={14}
              className="h-[300px] sm:h-[340px] md:h-[360px]"
            >
              <MilkChartContent
                data={data}
                averageMilk={averageMilk}
                highestDay={highestDay}
                lowestDay={lowestDay}
                onChartClick={handleChartClick}
              />
            </ResponsiveChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <MilkDayDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        farmId={farmId}
        date={selectedDate || ''}
        minDate={minDate}
        maxDate={maxDate}
        onDateChange={handleDateChange}
      />
    </>
  );
};

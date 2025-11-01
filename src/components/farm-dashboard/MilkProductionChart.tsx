import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CombinedDailyData } from "./hooks/useMilkData";

interface MilkProductionChartProps {
  data: CombinedDailyData[];
  timePeriod: "last30" | "ytd";
  selectedYear: number;
  onTimePeriodChange: (period: "last30" | "ytd") => void;
  onYearChange: (year: number) => void;
}

/**
 * Chart component displaying daily milk production over time
 */
export const MilkProductionChart = ({
  data,
  timePeriod,
  selectedYear,
  onTimePeriodChange,
  onYearChange
}: MilkProductionChartProps) => {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Daily Milk Production</CardTitle>
            <CardDescription>Liters of milk produced daily</CardDescription>
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
          <div className="h-[260px] flex items-center justify-center text-muted-foreground">
            No data for selected period
          </div>
        ) : (
          <ChartContainer
            config={{
              milkTotal: {
                label: "Milk (Liters)",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="aspect-auto w-full h-[260px] sm:h-[320px] md:h-[360px]"
          >
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickMargin={8}
                minTickGap={12}
                interval="preserveStartEnd"
              />
              <YAxis 
                width={40}
                tickFormatter={(v) => (Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : `${v}`)}
              />
              <ChartTooltip content={<ChartTooltipContent labelKey="date" />} />
              <Area
                type="monotone"
                dataKey="milkTotal"
                name="Milk (Liters)"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

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
        <ChartContainer
          config={{
            milk: {
              label: "Milk (Liters)",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-[300px]"
        >
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
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
      </CardContent>
    </Card>
  );
};

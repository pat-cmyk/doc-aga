import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MonthlyHeadcount } from "./hooks/useHeadcountData";

interface HeadcountChartProps {
  data: MonthlyHeadcount[];
  stageKeys: string[];
  monthlyTimePeriod: "all" | "ytd";
  selectedYear: number;
  onMonthlyTimePeriodChange: (period: "all" | "ytd") => void;
  onYearChange: (year: number) => void;
}

const STAGE_COLORS: Record<string, string> = {
  "Calf": "hsl(var(--chart-1))",
  "Heifer Calf": "hsl(var(--chart-2))",
  "Yearling Heifer": "hsl(var(--chart-3))",
  "Breeding Heifer": "hsl(var(--chart-4))",
  "Pregnant Heifer": "hsl(var(--chart-5))",
  "First-Calf Heifer": "hsl(var(--accent))",
  "Mature Cow": "hsl(var(--primary))",
  "Bull Calf": "hsl(210 40% 60%)",
  "Young Bull": "hsl(210 50% 50%)",
  "Mature Bull": "hsl(210 60% 40%)",
};

/**
 * Chart component displaying monthly cattle headcount by life stage
 */
export const HeadcountChart = ({
  data,
  stageKeys,
  monthlyTimePeriod,
  selectedYear,
  onMonthlyTimePeriodChange,
  onYearChange
}: HeadcountChartProps) => {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Monthly Cattle Headcount by Stage</CardTitle>
            <CardDescription>Distribution of animals by life stage</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={monthlyTimePeriod} onValueChange={(v) => onMonthlyTimePeriodChange(v as "all" | "ytd")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            {monthlyTimePeriod === "ytd" && (
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
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {stageKeys.map((stage, index) => (
              <Bar
                key={stage}
                dataKey={stage}
                stackId="a"
                fill={STAGE_COLORS[stage] || `hsl(${(index * 30) % 360} 70% 50%)`}
                name={stage}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

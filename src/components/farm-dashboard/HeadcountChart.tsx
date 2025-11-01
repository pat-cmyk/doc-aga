import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
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
  // Female stages - progression from warm to cool
  "Calf": "hsl(280 65% 60%)",           // Purple - young animals
  "Heifer Calf": "hsl(320 60% 65%)",    // Pink - young female
  "Yearling Heifer": "hsl(15 75% 60%)", // Coral - growing
  "Breeding Heifer": "hsl(45 80% 55%)", // Gold - ready to breed
  "Pregnant Heifer": "hsl(85 60% 50%)", // Lime - pregnant
  "First-Calf Heifer": "hsl(160 50% 50%)", // Teal - transition
  "Mature Cow": "hsl(200 60% 50%)",     // Sky blue - mature
  "Early Lactation": "hsl(130 55% 55%)", // Green - lactating
  
  // Male stages - blue family
  "Bull Calf": "hsl(210 70% 65%)",      // Light blue - young
  "Young Bull": "hsl(220 65% 55%)",     // Medium blue - growing
  "Mature Bull": "hsl(240 60% 45%)",    // Deep blue - mature
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
        {!data?.length ? (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">
            No data for selected period
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[640px]">
              <ChartContainer
                config={stageKeys.reduce((acc, stage, index) => ({
                  ...acc,
                  [stage]: {
                    label: stage,
                    color: STAGE_COLORS[stage] || `hsl(${(index * 30) % 360} 70% 50%)`,
                  }
                }), {})}
                className="aspect-auto w-full h-[320px] sm:h-[360px]"
              >
                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    tickMargin={8}
                    minTickGap={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis width={40} />
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
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

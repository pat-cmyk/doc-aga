import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { 
  ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, 
  Legend, Tooltip, ReferenceLine, Brush 
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrendingUp, TrendingDown, Minus, Users, BarChart3 } from "lucide-react";
import type { MonthlyHeadcount } from "./hooks/useHeadcountData";
import { HeadcountTooltip } from "./HeadcountTooltip";
import { HeadcountMonthDialog } from "./HeadcountMonthDialog";

interface HeadcountChartProps {
  data: MonthlyHeadcount[];
  stageKeys: string[];
  monthlyTimePeriod: "all" | "ytd";
  selectedYear: number;
  onMonthlyTimePeriodChange: (period: "all" | "ytd") => void;
  onYearChange: (year: number) => void;
  farmId: string;
}

// Stage category definitions
const STAGE_CATEGORIES = {
  productive: ["Mature Cow", "Early Lactation", "First-Calf Heifer"],
  development: ["Calf", "Heifer Calf", "Yearling Heifer", "Breeding Heifer", 
                "Pregnant Heifer", "Bull Calf", "Young Bull"],
  breeding: ["Mature Bull"]
};

const STAGE_COLORS: Record<string, string> = {
  "Calf": "hsl(280 65% 60%)",
  "Heifer Calf": "hsl(320 60% 65%)",
  "Yearling Heifer": "hsl(15 75% 60%)",
  "Breeding Heifer": "hsl(45 80% 55%)",
  "Pregnant Heifer": "hsl(85 60% 50%)",
  "First-Calf Heifer": "hsl(160 50% 50%)",
  "Mature Cow": "hsl(200 60% 50%)",
  "Early Lactation": "hsl(130 55% 55%)",
  "Bull Calf": "hsl(210 70% 65%)",
  "Young Bull": "hsl(220 65% 55%)",
  "Mature Bull": "hsl(240 60% 45%)",
};

type CategoryFilter = "all" | "productive" | "development" | "breeding" | "female" | "male";

const FEMALE_STAGES = ["Calf", "Heifer Calf", "Yearling Heifer", "Breeding Heifer", 
                       "Pregnant Heifer", "First-Calf Heifer", "Mature Cow", "Early Lactation"];
const MALE_STAGES = ["Bull Calf", "Young Bull", "Mature Bull"];

export const HeadcountChart = ({
  data,
  stageKeys,
  monthlyTimePeriod,
  selectedYear,
  onMonthlyTimePeriodChange,
  onYearChange,
  farmId
}: HeadcountChartProps) => {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter stage keys based on category
  const filteredStageKeys = useMemo(() => {
    switch (categoryFilter) {
      case "productive":
        return stageKeys.filter(s => STAGE_CATEGORIES.productive.includes(s));
      case "development":
        return stageKeys.filter(s => STAGE_CATEGORIES.development.includes(s));
      case "breeding":
        return stageKeys.filter(s => STAGE_CATEGORIES.breeding.includes(s));
      case "female":
        return stageKeys.filter(s => FEMALE_STAGES.includes(s));
      case "male":
        return stageKeys.filter(s => MALE_STAGES.includes(s));
      default:
        return stageKeys;
    }
  }, [stageKeys, categoryFilter]);

  // Enhance data with totals and trend line
  const enhancedData = useMemo(() => {
    return data.map((item, index) => {
      const total = filteredStageKeys.reduce((sum, key) => sum + (Number(item[key]) || 0), 0);
      const prevTotal = index > 0 
        ? filteredStageKeys.reduce((sum, key) => sum + (Number(data[index - 1][key]) || 0), 0)
        : null;
      
      return {
        ...item,
        total,
        prevTotal
      };
    });
  }, [data, filteredStageKeys]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (enhancedData.length === 0) return null;
    
    const totals = enhancedData.map(d => d.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const firstTotal = totals[0];
    const lastTotal = totals[totals.length - 1];
    const netGrowth = lastTotal - firstTotal;
    const growthPercent = firstTotal > 0 ? ((netGrowth / firstTotal) * 100).toFixed(1) : "0";
    
    // Find best month
    const maxTotal = Math.max(...totals);
    const bestMonthIndex = totals.indexOf(maxTotal);
    const bestMonth = enhancedData[bestMonthIndex]?.month;

    return {
      avg: Math.round(avg),
      netGrowth,
      growthPercent,
      bestMonth,
      maxTotal
    };
  }, [enhancedData]);

  // Handle bar click
  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload?.month) {
      setSelectedMonth(data.activePayload[0].payload.month);
      setDialogOpen(true);
    }
  };

  // Get selected month data
  const selectedMonthData = useMemo(() => {
    if (!selectedMonth) return {};
    const monthData = data.find(d => d.month === selectedMonth);
    if (!monthData) return {};
    
    const result: Record<string, number> = {};
    stageKeys.forEach(key => {
      result[key] = Number(monthData[key]) || 0;
    });
    return result;
  }, [selectedMonth, data, stageKeys]);

  // Navigation helpers for dialog
  const currentMonthIndex = data.findIndex(d => d.month === selectedMonth);
  const hasPrevMonth = currentMonthIndex > 0;
  const hasNextMonth = currentMonthIndex < data.length - 1;

  const handleNavigate = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" ? currentMonthIndex - 1 : currentMonthIndex + 1;
    if (newIndex >= 0 && newIndex < data.length) {
      setSelectedMonth(data[newIndex].month);
    }
  };

  // Get previous total for tooltip
  const getPreviousTotal = (month: string) => {
    const index = enhancedData.findIndex(d => d.month === month);
    return index > 0 ? enhancedData[index - 1].total : undefined;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Headcount by Stage
              </CardTitle>
              <CardDescription>Distribution of animals by life stage</CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={monthlyTimePeriod} onValueChange={(v) => onMonthlyTimePeriodChange(v as "all" | "ytd")}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ytd">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              {monthlyTimePeriod === "ytd" && (
                <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
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

          {/* Category filter */}
          <div className="pt-2">
            <ToggleGroup 
              type="single" 
              value={categoryFilter} 
              onValueChange={(v) => v && setCategoryFilter(v as CategoryFilter)}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="all" size="sm">All</ToggleGroupItem>
              <ToggleGroupItem value="productive" size="sm">Productive</ToggleGroupItem>
              <ToggleGroupItem value="development" size="sm">Development</ToggleGroupItem>
              <ToggleGroupItem value="breeding" size="sm">Breeding</ToggleGroupItem>
              <ToggleGroupItem value="female" size="sm">Female</ToggleGroupItem>
              <ToggleGroupItem value="male" size="sm">Male</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Summary stats row */}
          {summaryStats && (
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold">{summaryStats.avg}</span>
                </div>
                <p className="text-xs text-muted-foreground">Avg Headcount</p>
              </div>
              <div className={`rounded-lg p-2 text-center ${
                summaryStats.netGrowth >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                <div className="flex items-center justify-center gap-1">
                  {summaryStats.netGrowth > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : summaryStats.netGrowth < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  ) : (
                    <Minus className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={`text-lg font-bold ${
                    summaryStats.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {summaryStats.netGrowth > 0 ? '+' : ''}{summaryStats.netGrowth}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Net Growth ({summaryStats.growthPercent}%)
                </p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-primary">{summaryStats.maxTotal}</p>
                <p className="text-xs text-muted-foreground truncate" title={summaryStats.bestMonth}>
                  Peak ({summaryStats.bestMonth})
                </p>
              </div>
            </div>
          )}
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
                  config={filteredStageKeys.reduce((acc, stage, index) => ({
                    ...acc,
                    [stage]: {
                      label: stage,
                      color: STAGE_COLORS[stage] || `hsl(${(index * 30) % 360} 70% 50%)`,
                    }
                  }), {})}
                  className="aspect-auto w-full h-[320px] sm:h-[360px]"
                >
                  <ComposedChart 
                    data={enhancedData} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
                    onClick={handleBarClick}
                  >
                    <defs>
                      <linearGradient id="headcountGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 11 }} 
                      tickMargin={8}
                      minTickGap={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis width={40} />
                    <Tooltip 
                      content={({ active, payload, label }) => (
                        <HeadcountTooltip
                          active={active}
                          payload={payload}
                          label={label}
                          previousTotal={getPreviousTotal(label as string)}
                          stageCategories={STAGE_CATEGORIES}
                        />
                      )}
                    />
                    
                    {/* Average reference line */}
                    {summaryStats && (
                      <ReferenceLine 
                        y={summaryStats.avg} 
                        stroke="hsl(var(--primary))" 
                        strokeDasharray="5 5"
                        strokeOpacity={0.6}
                        label={{ 
                          value: `Avg: ${summaryStats.avg}`, 
                          position: 'right',
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: 11
                        }}
                      />
                    )}

                    <Legend 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      iconSize={10}
                    />
                    
                    {/* Stacked bars for each stage */}
                    {filteredStageKeys.map((stage, index) => (
                      <Bar
                        key={stage}
                        dataKey={stage}
                        stackId="a"
                        fill={STAGE_COLORS[stage] || `hsl(${(index * 30) % 360} 70% 50%)`}
                        name={stage}
                        cursor="pointer"
                        radius={index === filteredStageKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}

                    {/* Trend line overlay */}
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Total Trend"
                      legendType="none"
                    />

                    {/* Brush for zoom/pan */}
                    {data.length > 6 && (
                      <Brush 
                        dataKey="month" 
                        height={30} 
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--muted))"
                        travellerWidth={10}
                      />
                    )}
                  </ComposedChart>
                </ChartContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month detail dialog */}
      <HeadcountMonthDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        farmId={farmId}
        month={selectedMonth || ""}
        stageData={selectedMonthData}
        onNavigate={handleNavigate}
        hasPrev={hasPrevMonth}
        hasNext={hasNextMonth}
        stageCategories={STAGE_CATEGORIES}
      />
    </>
  );
};

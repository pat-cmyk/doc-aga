import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { 
  ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, 
  Legend, Tooltip, ReferenceLine, Brush 
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrendingUp, TrendingDown, Minus, Users, BarChart3, AlertCircle, RefreshCw } from "lucide-react";
import type { MonthlyHeadcount } from "./hooks/useHeadcountData";
import { HeadcountTooltip } from "./HeadcountTooltip";
import { HeadcountMonthDialog } from "./HeadcountMonthDialog";
import { Button } from "@/components/ui/button";
import { Sprout } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeadcountChartProps {
  data: MonthlyHeadcount[];
  stageKeys: string[];
  monthlyTimePeriod: "all" | "ytd";
  selectedYear: number;
  onMonthlyTimePeriodChange: (period: "all" | "ytd") => void;
  onYearChange: (year: number) => void;
  farmId: string;
  totalAnimals?: number;
  onRefresh?: () => void;
  isLoading?: boolean;
  showFeedForecast?: boolean;
  onToggleFeedForecast?: () => void;
}

// Stage category definitions - includes all species (cattle, carabao, goat, sheep)
const STAGE_CATEGORIES = {
  productive: [
    // Cattle
    "Mature Cow", "Early Lactation", "First-Calf Heifer",
    // Carabao
    "Mature Carabao", "First-Time Mother",
    // Goat
    "Mature Doe", "First Freshener",
    // Sheep
    "Mature Ewe", "First-Time Mother Ewe"
  ],
  development: [
    // Cattle
    "Calf", "Heifer Calf", "Yearling Heifer", "Breeding Heifer", 
    "Pregnant Heifer", "Bull Calf", "Young Bull",
    // Carabao
    "Carabao Calf", "Young Carabao", "Breeding Carabao", "Pregnant Carabao",
    "Young Bull Carabao",
    // Goat
    "Kid", "Doeling", "Breeding Doe", "Pregnant Doe", "Buckling", "Young Buck",
    // Sheep
    "Lamb", "Ewe Lamb", "Breeding Ewe", "Pregnant Ewe", "Ram Lamb", "Young Ram"
  ],
  breeding: [
    // Cattle
    "Mature Bull",
    // Carabao
    "Mature Bull Carabao",
    // Goat
    "Buck",
    // Sheep
    "Mature Ram"
  ]
};

const STAGE_COLORS: Record<string, string> = {
  // Cattle
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
  // Carabao
  "Carabao Calf": "hsl(275 55% 55%)",
  "Young Carabao": "hsl(310 50% 60%)",
  "Breeding Carabao": "hsl(35 75% 55%)",
  "Pregnant Carabao": "hsl(75 55% 50%)",
  "First-Time Mother": "hsl(150 50% 50%)",
  "Mature Carabao": "hsl(190 55% 50%)",
  "Young Bull Carabao": "hsl(205 60% 55%)",
  "Mature Bull Carabao": "hsl(225 55% 45%)",
  // Goat
  "Kid": "hsl(350 60% 60%)",
  "Buckling": "hsl(200 60% 60%)",
  "Doeling": "hsl(330 55% 60%)",
  "Breeding Doe": "hsl(55 70% 50%)",
  "Pregnant Doe": "hsl(95 55% 50%)",
  "First Freshener": "hsl(140 50% 50%)",
  "Mature Doe": "hsl(170 55% 50%)",
  "Young Buck": "hsl(195 60% 55%)",
  "Buck": "hsl(215 60% 45%)",
  // Sheep
  "Lamb": "hsl(340 55% 60%)",
  "Ram Lamb": "hsl(190 55% 60%)",
  "Ewe Lamb": "hsl(315 50% 60%)",
  "Breeding Ewe": "hsl(65 65% 50%)",
  "Pregnant Ewe": "hsl(105 50% 50%)",
  "First-Time Mother Ewe": "hsl(135 50% 50%)",
  "Mature Ewe": "hsl(165 55% 50%)",
  "Young Ram": "hsl(180 55% 55%)",
  "Mature Ram": "hsl(210 55% 45%)"
};

type CategoryFilter = "all" | "productive" | "development" | "breeding" | "female" | "male";

const FEMALE_STAGES = [
  // Cattle
  "Calf", "Heifer Calf", "Yearling Heifer", "Breeding Heifer", 
  "Pregnant Heifer", "First-Calf Heifer", "Mature Cow", "Early Lactation",
  // Carabao
  "Carabao Calf", "Young Carabao", "Breeding Carabao", "Pregnant Carabao",
  "First-Time Mother", "Mature Carabao",
  // Goat
  "Kid", "Doeling", "Breeding Doe", "Pregnant Doe", "First Freshener", "Mature Doe",
  // Sheep
  "Lamb", "Ewe Lamb", "Breeding Ewe", "Pregnant Ewe", "First-Time Mother Ewe", "Mature Ewe"
];

const MALE_STAGES = [
  // Cattle
  "Bull Calf", "Young Bull", "Mature Bull",
  // Carabao
  "Young Bull Carabao", "Mature Bull Carabao",
  // Goat
  "Buckling", "Young Buck", "Buck",
  // Sheep
  "Ram Lamb", "Young Ram", "Mature Ram"
];

export const HeadcountChart = ({
  data,
  stageKeys,
  monthlyTimePeriod,
  selectedYear,
  onMonthlyTimePeriodChange,
  onYearChange,
  farmId,
  totalAnimals = 0,
  onRefresh,
  isLoading = false,
  showFeedForecast = false,
  onToggleFeedForecast
}: HeadcountChartProps) => {
  const isMobile = useIsMobile();
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
              {onToggleFeedForecast && (
                <Button
                  variant={showFeedForecast ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleFeedForecast}
                  className="h-8"
                >
                  <Sprout className="h-4 w-4 mr-1.5" />
                  Feed Forecast
                </Button>
              )}
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
            <div className="h-[220px] sm:h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-medium">No headcount data for {selectedYear}</p>
                {totalAnimals > 0 ? (
                  <p className="text-sm mt-1">
                    You have {totalAnimals} animal{totalAnimals !== 1 ? 's' : ''} registered.
                    <br />
                    Stats are calculated overnight or on first dashboard load.
                  </p>
                ) : (
                  <p className="text-sm mt-1">Add animals to start tracking headcount.</p>
                )}
              </div>
              {onRefresh && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="mt-2"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Stats
                </Button>
              )}
            </div>
          ) : (
            <div className="w-full">
              <ChartContainer
                config={filteredStageKeys.reduce((acc, stage, index) => ({
                  ...acc,
                  [stage]: {
                    label: stage,
                    color: STAGE_COLORS[stage] || `hsl(${(index * 30) % 360} 70% 50%)`,
                  }
                }), {})}
                className="aspect-auto w-full h-[320px] sm:h-[360px] md:h-[380px]"
              >
                <ComposedChart 
                  data={enhancedData} 
                  margin={{ top: 10, right: 10, left: 0, bottom: isMobile ? 100 : 70 }}
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
                      tick={{ fontSize: isMobile ? 9 : 11 }} 
                      tickMargin={isMobile ? 15 : 8}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 60 : 30}
                      interval={isMobile ? 0 : "preserveStartEnd"}
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
                      wrapperStyle={{ 
                        fontSize: isMobile ? '9px' : '11px', 
                        paddingTop: isMobile ? '16px' : '10px',
                        paddingBottom: isMobile ? '8px' : '0px'
                      }}
                      iconSize={isMobile ? 8 : 10}
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
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
                    {data.length > 6 && !isMobile && (
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

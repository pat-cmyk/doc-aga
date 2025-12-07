import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHerdValuation, useHerdValuationSummary } from "@/hooks/useHerdValuation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Beef, Loader2, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HerdValueChartProps {
  farmId: string;
}

export function HerdValueChart({ farmId }: HerdValueChartProps) {
  const { data: chartData, isLoading: chartLoading } = useHerdValuation(farmId);
  const { data: summary, isLoading: summaryLoading } = useHerdValuationSummary(farmId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isLoading = chartLoading || summaryLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = chartData && chartData.some((d) => d.totalValue > 0);
  const isGrowth = (summary?.changePercent ?? 0) >= 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beef className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Herd Value</CardTitle>
          </div>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Your herd is a living investment! This shows the estimated market value of your animals based on their current weight × ₱300/kg.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Biological asset valuation (Last 6 months)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Current Value Summary */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-3xl font-bold">
              {formatCurrency(summary?.currentValue ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              {summary?.animalCount ?? 0} animals valued
            </p>
          </div>
          {summary && summary.previousMonthValue > 0 && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                isGrowth
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {isGrowth ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {isGrowth ? "+" : ""}
                {summary.changePercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Chart */}
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="herdValueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Herd Value"]}
                labelStyle={{ fontWeight: "bold" }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                }}
              />
              <Area
                type="monotone"
                dataKey="totalValue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#herdValueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Beef className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-center">No valuation data yet</p>
            <p className="text-sm text-center mt-1">
              Record animal weights to start tracking herd value
            </p>
          </div>
        )}

        {/* Insight Banner */}
        {hasData && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <span className="font-medium">Living Bank Account:</span> Your herd grows in value even without sales. Each kilogram gained adds ₱300 to your assets!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

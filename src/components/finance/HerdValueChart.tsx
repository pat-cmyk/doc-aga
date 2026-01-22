import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHerdValuationUnified } from "@/hooks/useHerdValuationUnified";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Beef, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LocalPriceInputDialog } from "./LocalPriceInputDialog";
import { getSourceLabel } from "@/hooks/useMarketPrices";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface HerdValueChartProps {
  farmId: string;
  livestockType?: string;
}

export function HerdValueChart({ farmId, livestockType = "cattle" }: HerdValueChartProps) {
  const [chartExpanded, setChartExpanded] = useState(false);
  const { data: valuation, isLoading } = useHerdValuationUnified(farmId, livestockType, 3);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `₱${(value / 1000).toFixed(0)}k`;
    return `₱${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  // Map unified hook data
  const chartData = valuation?.monthlyTrend || [];
  const hasData = chartData.length > 0 && chartData.some((d) => d.value > 0);
  const changePercent = valuation?.changePercent ?? 0;
  const changeAmount = valuation?.changeAmount ?? 0;
  
  // Determine status
  const getStatusInfo = () => {
    if (changePercent >= 5) return { text: "Growing!", color: "text-green-600 dark:text-green-400" };
    if (changePercent >= 0) return { text: "Steady", color: "text-amber-600 dark:text-amber-400" };
    if (changePercent >= -5) return { text: "Watch this", color: "text-amber-600 dark:text-amber-400" };
    return { text: "Needs attention", color: "text-red-600 dark:text-red-400" };
  };
  
  const status = getStatusInfo();
  const isGrowth = changePercent >= 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Beef className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Your Animals' Worth</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <LocalPriceInputDialog farmId={farmId} defaultLivestockType={livestockType} />
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Your animals = your savings account! As they grow heavier, their worth increases.</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </div>
        <CardDescription>Growing value over time</CardDescription>
      </CardHeader>
      
      <CardContent className="pt-2 space-y-4">
        {/* Main Value + This Month Change - Side by Side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Current Value */}
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Current Value</p>
            <p className="text-2xl font-bold">{formatCompact(valuation?.currentValue ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              {valuation && valuation.missingWeightCount > 0
                ? `${valuation.animalsWithWeight} of ${valuation.animalCount} animals valued`
                : `${valuation?.animalCount ?? 0} animals`
              }
            </p>
          </div>
          
          {/* This Month Change - Prominent */}
          <div className={`p-3 rounded-lg ${
            isGrowth 
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          }`}>
            <p className="text-xs text-muted-foreground mb-1">This Month</p>
            <div className="flex items-center gap-1">
              {isGrowth ? (
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-lg font-bold ${isGrowth ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {isGrowth ? "+" : ""}{formatCompact(changeAmount)}
              </span>
            </div>
            <p className={`text-xs font-medium ${status.color}`}>
              {changePercent !== 0 ? `${isGrowth ? "+" : ""}${changePercent.toFixed(1)}% • ` : ""}{status.text}
            </p>
          </div>
        </div>

        {/* Market Price - Simplified */}
        {valuation && (
          <div className="flex items-center justify-between text-sm px-1">
            <span className="text-muted-foreground">
              ₱{valuation.marketPrice.toFixed(0)}/kg 
              <span className="text-xs ml-1">({getSourceLabel(valuation.priceSource)})</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(valuation.priceDate), "MMM d")}
            </span>
          </div>
        )}

        {/* Chart - Collapsible on Mobile */}
        {hasData ? (
          <>
            {/* Mobile: Collapsible */}
            <div className="md:hidden">
              <Collapsible open={chartExpanded} onOpenChange={setChartExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span>{chartExpanded ? "Hide chart" : "See how it's growing"}</span>
                    {chartExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="herdValueGradientMobile" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => formatCompact(value)}
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={45}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Value"]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--card))",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#herdValueGradientMobile)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Desktop: Always Visible */}
            <div className="hidden md:block">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="herdValueGradientDesktop" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(value) => formatCompact(value)}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Value"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#herdValueGradientDesktop)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Beef className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm text-center">No valuation data yet</p>
            <p className="text-xs text-center mt-1">Record animal weights to start tracking</p>
          </div>
        )}

        {/* Simple Insight */}
        {hasData && valuation && (
          <p className="text-xs text-muted-foreground text-center px-2">
            💡 Each kg gained = ₱{valuation.marketPrice.toFixed(0)} more value!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

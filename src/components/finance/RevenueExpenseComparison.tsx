import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useRevenueExpenseComparison } from "@/hooks/useRevenueExpenseComparison";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface DateRange {
  start: Date;
  end: Date;
}

interface RevenueExpenseComparisonProps {
  farmId: string;
  dateRange?: DateRange;
}

function formatCompact(value: number): string {
  if (value >= 1000000) {
    return `₱${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `₱${(value / 1000).toFixed(0)}K`;
  }
  return `₱${value.toFixed(0)}`;
}

function TrendIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const isNegative = inverted ? value > 0 : value < 0;
  
  if (Math.abs(value) < 0.5) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </span>
    );
  }
  
  return (
    <span className={cn(
      "flex items-center gap-1 text-xs font-medium",
      isPositive && "text-emerald-600",
      isNegative && "text-destructive"
    )}>
      {value > 0 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{Math.abs(value).toFixed(0)}%</span>
    </span>
  );
}

function SourceBar({ 
  label, 
  amount, 
  percentage, 
  variant 
}: { 
  label: string; 
  amount: number; 
  percentage: number; 
  variant: "revenue" | "expense";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground truncate max-w-[100px]">{label}</span>
        <span className="font-medium">{formatCompact(amount)}</span>
      </div>
      <Progress 
        value={percentage} 
        className={cn(
          "h-1.5",
          variant === "revenue" 
            ? "[&>div]:bg-emerald-500" 
            : "[&>div]:bg-orange-500"
        )}
      />
    </div>
  );
}

export function RevenueExpenseComparison({ farmId, dateRange }: RevenueExpenseComparisonProps) {
  const { data, isLoading } = useRevenueExpenseComparison(farmId, dateRange);

  const getPeriodLabel = () => {
    if (!dateRange) return "This Month";
    const startStr = format(dateRange.start, "MMM d");
    const endStr = format(dateRange.end, "MMM d");
    return `${startStr} - ${endStr}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Money In vs Money Out</CardTitle>
          <span className="text-xs text-muted-foreground">{getPeriodLabel()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Money In Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-emerald-100">
                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Money In</span>
            </div>
            
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-emerald-600">
                {formatCompact(data.revenueThisMonth)}
              </span>
              <TrendIndicator value={data.revenueChange} />
            </div>

            <div className="space-y-2.5">
              {data.topRevenueSources.length > 0 ? (
                data.topRevenueSources.map((source) => (
                  <SourceBar
                    key={source.source}
                    label={source.source}
                    amount={source.amount}
                    percentage={source.percentage}
                    variant="revenue"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No revenue this period</p>
              )}
            </div>
          </div>

          {/* Money Out Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-100">
                <ArrowUpRight className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Money Out</span>
            </div>
            
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-orange-600">
                {formatCompact(data.expenseThisMonth)}
              </span>
              <TrendIndicator value={data.expenseChange} inverted />
            </div>

            <div className="space-y-2.5">
              {data.topExpenseCategories.length > 0 ? (
                data.topExpenseCategories.map((cat) => (
                  <SourceBar
                    key={cat.category}
                    label={cat.category}
                    amount={cat.amount}
                    percentage={cat.percentage}
                    variant="expense"
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No expenses this period</p>
              )}
            </div>
          </div>
        </div>

        {/* Year-to-Date Summary */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Year-to-Date:</span>
            <span className="font-medium text-foreground">
              {formatCompact(data.revenueThisYear)} earned
            </span>
            <span>•</span>
            <span className="font-medium text-foreground">
              {formatCompact(data.expenseThisYear)} spent
            </span>
            <span>•</span>
            <span className={cn(
              "font-semibold",
              data.netThisYear >= 0 ? "text-emerald-600" : "text-destructive"
            )}>
              Net {data.netThisYear >= 0 ? "+" : ""}{formatCompact(data.netThisYear)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

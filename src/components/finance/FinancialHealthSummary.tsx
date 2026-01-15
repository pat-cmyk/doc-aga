import { TrendingUp, TrendingDown, Minus, CircleCheck, CircleAlert, CircleX, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialHealth } from "@/hooks/useFinancialHealth";
import { cn } from "@/lib/utils";

interface FinancialHealthSummaryProps {
  farmId: string;
}

export function FinancialHealthSummary({ farmId }: FinancialHealthSummaryProps) {
  const { data, isLoading } = useFinancialHealth(farmId);

  const formatCompact = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `₱${(value / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `₱${(value / 1000).toFixed(1)}K`;
    }
    return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
  };

  const formatFull = (value: number) => {
    return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const getStatusConfig = () => {
    switch (data.status) {
      case 'excellent':
        return {
          icon: CircleCheck,
          label: "Excellent",
          bgClass: "bg-green-500/10",
          borderClass: "border-green-500/30",
          iconClass: "text-green-500",
          labelClass: "text-green-600 dark:text-green-400",
        };
      case 'good':
        return {
          icon: CircleCheck,
          label: "Profitable",
          bgClass: "bg-green-500/10",
          borderClass: "border-green-500/30",
          iconClass: "text-green-500",
          labelClass: "text-green-600 dark:text-green-400",
        };
      case 'warning':
        return {
          icon: CircleAlert,
          label: "Near Breakeven",
          bgClass: "bg-yellow-500/10",
          borderClass: "border-yellow-500/30",
          iconClass: "text-yellow-500",
          labelClass: "text-yellow-600 dark:text-yellow-400",
        };
      case 'critical':
        return {
          icon: CircleX,
          label: "Loss",
          bgClass: "bg-red-500/10",
          borderClass: "border-red-500/30",
          iconClass: "text-red-500",
          labelClass: "text-red-600 dark:text-red-400",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendClass = (value: number, isExpense = false) => {
    // For expenses, down is good (green), up is bad (red)
    if (isExpense) {
      if (value > 0) return "text-red-500";
      if (value < 0) return "text-green-500";
    } else {
      if (value > 0) return "text-green-500";
      if (value < 0) return "text-red-500";
    }
    return "text-muted-foreground";
  };

  // Clamp progress for visual display
  const progressValue = Math.min(Math.max(data.breakevenProgress, 0), 100);

  return (
    <Card className={cn("overflow-hidden border-2", statusConfig.borderClass, statusConfig.bgClass)}>
      <CardContent className="p-4 sm:p-6">
        {/* Header with status badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Your Farm This Month</h3>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
            statusConfig.bgClass,
            statusConfig.labelClass
          )}>
            <StatusIcon className={cn("h-4 w-4", statusConfig.iconClass)} />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Three metric cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          {/* Earned */}
          <div className="bg-background/60 rounded-lg p-3 text-center border border-border/50">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Earned</p>
            <p className="text-lg sm:text-2xl font-bold text-primary" title={formatFull(data.earnedThisMonth)}>
              {formatCompact(data.earnedThisMonth)}
            </p>
            <div className={cn("flex items-center justify-center gap-1 text-xs mt-1", getTrendClass(data.earnedChange))}>
              <TrendIcon value={data.earnedChange} />
              <span>{Math.abs(data.earnedChange).toFixed(0)}%</span>
            </div>
          </div>

          {/* Spent */}
          <div className="bg-background/60 rounded-lg p-3 text-center border border-border/50">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Spent</p>
            <p className="text-lg sm:text-2xl font-bold text-destructive" title={formatFull(data.spentThisMonth)}>
              {formatCompact(data.spentThisMonth)}
            </p>
            <div className={cn("flex items-center justify-center gap-1 text-xs mt-1", getTrendClass(data.spentChange, true))}>
              <TrendIcon value={data.spentChange} />
              <span>{Math.abs(data.spentChange).toFixed(0)}%</span>
            </div>
          </div>

          {/* Net */}
          <div className={cn(
            "rounded-lg p-3 text-center border",
            data.isProfitable 
              ? "bg-green-500/10 border-green-500/30" 
              : "bg-red-500/10 border-red-500/30"
          )}>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Net</p>
            <p className={cn(
              "text-lg sm:text-2xl font-bold",
              data.isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )} title={formatFull(data.netProfit)}>
              {data.netProfit >= 0 ? "+" : ""}{formatCompact(data.netProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.isProfitable ? "Profit" : "Loss"}
            </p>
          </div>
        </div>

        {/* Breakeven progress bar */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Breakeven Progress</span>
            <span className={cn(
              "font-medium",
              data.breakevenProgress >= 100 ? "text-green-600" : "text-muted-foreground"
            )}>
              {data.breakevenProgress.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={progressValue} 
            className={cn(
              "h-2",
              data.breakevenProgress >= 100 ? "[&>div]:bg-green-500" : "[&>div]:bg-primary"
            )}
          />
        </div>

        {/* Daily insight */}
        <div className={cn(
          "rounded-lg px-3 py-2 text-sm",
          data.isProfitable ? "bg-green-500/10" : "bg-red-500/10"
        )}>
          <span className={data.isProfitable ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
            {data.isProfitable ? "📈" : "📉"} You're {data.isProfitable ? "making" : "losing"}{" "}
            <strong>{formatCompact(Math.abs(data.dailyProfit))}/day</strong> on average this month
            {data.topRevenueSource && data.isProfitable && (
              <span className="hidden sm:inline"> • Top source: {data.topRevenueSource}</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

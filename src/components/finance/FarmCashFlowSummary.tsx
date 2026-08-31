import { TrendingUp, TrendingDown, Minus, CircleCheck, CircleAlert, CircleX, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialHealth } from "@/hooks/useFinancialHealth";
import { useProfitability } from "@/hooks/useProfitability";
import { useMilkSpoilageReport } from "@/hooks/useMilkSpoilageReport";
import { cn } from "@/lib/utils";
import { formatPHP, formatPHPCompact } from "@/lib/currency";
import { getRevenueSourceIcon, REVENUE_SOURCE_KEYS } from "@/lib/revenueCategories";
import { getExpenseCategoryIcon } from "@/lib/expenseCategories";
import { format } from "date-fns";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";

interface FarmCashFlowSummaryProps {
  farmId: string;
  dateRange?: DateRange;
}

export function FarmCashFlowSummary({ farmId, dateRange }: FarmCashFlowSummaryProps) {
  const { data: healthData, isLoading: healthLoading } = useFinancialHealth(farmId, dateRange);
  const { data: profitData, isLoading: profitLoading } = useProfitability(farmId, dateRange);
  const { data: spoilageData } = useMilkSpoilageReport(farmId, dateRange);

  const isLoading = healthLoading || profitLoading;

  const formatFull = (value: number) => {
    return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPeriodLabel = () => {
    if (!dateRange) return "This Month";
    const startStr = format(dateRange.start, "MMM d");
    const endStr = format(dateRange.end, "MMM d, yyyy");
    return `${startStr} - ${endStr}`;
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!healthData || !profitData) return null;

  // --- Status config (reuses FinancialHealthSummary pattern) ---
  const getStatusConfig = () => {
    switch (healthData.status) {
      case "excellent":
        return {
          icon: CircleCheck,
          label: "Excellent",
          bgClass: "bg-success/10",
          borderClass: "border-success/30",
          iconClass: "text-success",
          labelClass: "text-success",
        };
      case "good":
        return {
          icon: CircleCheck,
          label: "Profitable",
          bgClass: "bg-success/10",
          borderClass: "border-success/30",
          iconClass: "text-success",
          labelClass: "text-success",
        };
      case "warning":
        return {
          icon: CircleAlert,
          label: "Near Breakeven",
          bgClass: "bg-warning/10",
          borderClass: "border-warning/30",
          iconClass: "text-warning",
          labelClass: "text-warning",
        };
      case "critical":
        return {
          icon: CircleX,
          label: "Loss",
          bgClass: "bg-destructive/10",
          borderClass: "border-destructive/30",
          iconClass: "text-destructive",
          labelClass: "text-destructive",
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
    if (isExpense) {
      if (value > 0) return "text-destructive";
      if (value < 0) return "text-success";
    } else {
      if (value > 0) return "text-success";
      if (value < 0) return "text-destructive";
    }
    return "text-muted-foreground";
  };

  // Clamp progress for visual display
  const progressValue = Math.min(Math.max(healthData.breakevenProgress, 0), 100);

  // Build revenue lines
  const revenueLines: { icon: string; label: string; amount: number }[] = [];
  if (profitData.milkRevenue > 0) {
    revenueLines.push({
      icon: getRevenueSourceIcon(REVENUE_SOURCE_KEYS.MILK_SALE),
      label: "Milk Sales",
      amount: profitData.milkRevenue,
    });
  }
  if (profitData.animalSalesRevenue > 0) {
    revenueLines.push({
      icon: getRevenueSourceIcon(REVENUE_SOURCE_KEYS.ANIMAL_SALE),
      label: "Animal Sales",
      amount: profitData.animalSalesRevenue,
    });
  }
  if (profitData.otherRevenue > 0) {
    revenueLines.push({
      icon: getRevenueSourceIcon("Other Income"),
      label: "Other Income",
      amount: profitData.otherRevenue,
    });
  }

  const hasCashIn = healthData.earnedThisMonth > 0;
  const hasCashOut = healthData.spentThisMonth > 0;
  const hasHerdGrowth = profitData.unrealizedGain !== 0;
  const hasSpoilage = (spoilageData?.lostRevenue || 0) > 0;

  return (
    <Card className={cn("overflow-hidden border-2", statusConfig.borderClass, statusConfig.bgClass)}>
      <CardContent className="p-4 sm:p-6">
        {/* Header with status badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Your Farm: {getPeriodLabel()}</h3>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
              statusConfig.bgClass,
              statusConfig.labelClass
            )}
          >
            <StatusIcon className={cn("h-4 w-4", statusConfig.iconClass)} />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Hero: Net Cash Income */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Net Cash Income</p>
            <p
              className={cn(
                "text-3xl sm:text-4xl font-bold",
                healthData.isProfitable
                  ? "text-success"
                  : "text-destructive"
              )}
              title={formatFull(healthData.netProfit)}
            >
              {healthData.netProfit >= 0 ? "+" : ""}
              {formatPHPCompact(healthData.netProfit)}
            </p>
          </div>
          <div className="text-right">
            <div className={cn("flex items-center justify-end gap-1 text-sm", getTrendClass(healthData.earnedChange))}>
              <TrendIcon value={healthData.earnedChange} />
              <span>{Math.abs(healthData.earnedChange).toFixed(0)}% vs prev</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {healthData.isProfitable ? "📈" : "📉"}{" "}
              <strong>{formatPHPCompact(Math.abs(healthData.dailyProfit))}/day</strong> avg
            </p>
          </div>
        </div>

        {/* === Cash In (Pumasok) === */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Pumasok (Cash In)
            </span>
            <span className="text-sm font-bold text-primary" title={formatFull(healthData.earnedThisMonth)}>
              {formatPHPCompact(healthData.earnedThisMonth)}
            </span>
          </div>
          <div className="border-t border-border/50" />
          {hasCashIn ? (
            <div className="mt-2 space-y-1.5">
              {revenueLines.map((line) => (
                <div key={line.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {line.icon} {line.label}
                  </span>
                  <span className="font-medium" title={formatFull(line.amount)}>
                    {formatPHP(line.amount)}
                  </span>
                </div>
              ))}
              {hasSpoilage && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">🥛 Milk Rejected (Lost)</span>
                  <span className="font-medium text-destructive">
                    -{formatPHP(spoilageData!.lostRevenue)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">
              Walang kita ngayong buwan
            </p>
          )}
        </div>

        {/* === Cash Out (Lumabas) === */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Lumabas (Cash Out)
            </span>
            <span className="text-sm font-bold text-destructive" title={formatFull(healthData.spentThisMonth)}>
              {formatPHPCompact(healthData.spentThisMonth)}
            </span>
          </div>
          <div className="border-t border-border/50" />
          {hasCashOut ? (
            <div className="mt-2 space-y-1.5">
              {profitData.topExpenseCategories.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {getExpenseCategoryIcon(cat.category)} {cat.category}
                  </span>
                  <span className="font-medium" title={formatFull(cat.amount)}>
                    {formatPHP(cat.amount)}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({cat.percentage.toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">
              Walang gastos ngayong buwan
            </p>
          )}
        </div>

        {/* === Breakeven Progress === */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">Breakeven</span>
            <span
              className={cn(
                "text-sm font-bold",
                healthData.breakevenProgress >= 100 ? "text-success" : "text-muted-foreground"
              )}
            >
              {healthData.breakevenProgress.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={progressValue}
            className={cn(
              "h-2",
              healthData.breakevenProgress >= 100 ? "[&>div]:bg-success" : "[&>div]:bg-primary"
            )}
          />
        </div>

        {/* === Herd Value (Non-cash) — only shown when non-zero === */}
        {hasHerdGrowth && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-muted-foreground">
                Herd Value <span className="text-xs font-normal">(Hindi pa cash)</span>
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  profitData.unrealizedGain >= 0
                    ? "text-success"
                    : "text-destructive"
                )}
              >
                {profitData.unrealizedGain >= 0 ? "+" : ""}
                {formatPHPCompact(profitData.unrealizedGain)}
              </span>
            </div>
            <div className="border-t border-border/50" />
            <p className="mt-2 text-xs text-muted-foreground">
              📈 Change in livestock market value this period
            </p>
          </div>
        )}

        {/* === Insight Footer === */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            healthData.isProfitable ? "bg-success/10" : "bg-destructive/10"
          )}
        >
          <span
            className={
              healthData.isProfitable
                ? "text-success"
                : "text-destructive"
            }
          >
            {healthData.isProfitable ? "✅" : "⚠️"}{" "}
            <InsightText
              isProfitable={healthData.isProfitable}
              spent={healthData.spentThisMonth}
              milkRevenue={profitData.milkRevenue}
              unrealizedGain={profitData.unrealizedGain}
              topRevenueSource={healthData.topRevenueSource}
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Generates a concise insight sentence about the period (reuses ProfitabilityThermometer pattern) */
function InsightText({
  isProfitable,
  spent,
  milkRevenue,
  unrealizedGain,
  topRevenueSource,
}: {
  isProfitable: boolean;
  spent: number;
  milkRevenue: number;
  unrealizedGain: number;
  topRevenueSource: string | null;
}) {
  const parts: React.ReactNode[] = [];

  parts.push(
    <span key="spent">
      You spent <strong>{formatPHPCompact(spent)}</strong>.
    </span>
  );

  if (milkRevenue > 0) {
    parts.push(
      <span key="milk">
        {" "}You earned <strong className="text-success">{formatPHPCompact(milkRevenue)}</strong> from milk sales.
      </span>
    );
  } else if (topRevenueSource && isProfitable) {
    parts.push(<span key="top"> Top source: {topRevenueSource}.</span>);
  }

  if (unrealizedGain > 0) {
    parts.push(
      <span key="herd">
        {" "}Herd grew by <strong className="text-success">{formatPHPCompact(unrealizedGain)}</strong>.
      </span>
    );
  }

  return <>{parts}</>;
}

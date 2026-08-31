/**
 * @deprecated Replaced by FarmCashFlowSummary.tsx which merges this breakeven dashboard
 * with FinancialHealthSummary into a single cash-focused P&L view. Kept for reference only.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProfitability } from "@/hooks/useProfitability";
import { useMilkSpoilageReport } from "@/hooks/useMilkSpoilageReport";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { DateRange } from "@/components/finance/FinanceDateRangePicker";
import { formatPHP } from "@/lib/currency";

interface ProfitabilityThermometerProps {
  farmId: string;
  dateRange?: DateRange;
}

export function ProfitabilityThermometer({ farmId, dateRange }: ProfitabilityThermometerProps) {
  const { data, isLoading } = useProfitability(farmId, dateRange);
  const { data: spoilageData } = useMilkSpoilageReport(farmId, dateRange);
  const { isMobile, fontSize } = useResponsiveChart({ size: 'small' });

  const getPeriodLabel = () => {
    if (!dateRange) {
      return format(new Date(), "MMMM yyyy");
    }
    const startStr = format(dateRange.start, "MMM d");
    const endStr = format(dateRange.end, "MMM d, yyyy");
    return `${startStr} - ${endStr}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[180px] w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      name: "Costs",
      value: data?.totalInput || 0,
      label: "Total Input",
    },
    {
      name: "Output",
      value: data?.totalOutput || 0,
      label: "Total Output",
    },
  ];

  const isProfitable = data?.isProfitable ?? true;
  const netPosition = data?.netPosition ?? 0;
  const hasData = (data?.totalInput || 0) > 0 || (data?.totalOutput || 0) > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Breakeven Dashboard</CardTitle>
          </div>
          <div
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
              isProfitable
                ? "bg-success-soft text-success"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {isProfitable ? (
              <>
                <TrendingUp className="h-4 w-4" />
                <span>Profitable</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4" />
                <span>Loss</span>
              </>
            )}
          </div>
        </div>
        <CardDescription>{getPeriodLabel()} P&L Overview</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Net Position Display */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">Net Position</p>
          <p
            className={`text-3xl font-bold ${
              isProfitable ? "text-success" : "text-destructive"
            }`}
          >
            {netPosition >= 0 ? "+" : ""}
            {formatPHP(netPosition)}
          </p>
        </div>

        {/* Bar Chart */}
        {hasData ? (
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                tick={{ fontSize }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: fontSize + 1, fontWeight: 500 }}
                width={isMobile ? 50 : 60}
              />
              <Tooltip
                formatter={(value: number) => [formatPHP(value), ""]}
                labelFormatter={(label) => (label === "Costs" ? "Total Costs" : "Total Output")}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={40}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index === 0
                        ? "hsl(var(--destructive))"
                        : isProfitable
                        ? "hsl(142.1, 76.2%, 36.3%)"
                        : "hsl(var(--muted-foreground))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[160px] text-muted-foreground">
            <Scale className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-center text-sm">No transactions this period yet</p>
          </div>
        )}

        {/* Breakdown Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
            <p className="text-xs text-destructive font-medium">Costs (Input)</p>
            <p className="text-lg font-bold text-destructive">
              {formatPHP(data?.operationalCosts || 0)}
            </p>
          </div>
          <div className="p-3 bg-success-soft/60 rounded-lg border border-success/20">
            <p className="text-xs text-success font-medium">Output</p>
            <p className="text-lg font-bold text-success">
              {formatPHP(data?.totalOutput || 0)}
            </p>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>💰 Cash Revenue (Milk Sales)</span>
            <span className="font-medium">{formatPHP(data?.milkRevenue || 0)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>🐄 Animal Sales</span>
            <span className="font-medium">{formatPHP(data?.animalSalesRevenue || 0)}</span>
          </div>
          {(data?.otherRevenue || 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>📦 Other Revenue</span>
              <span className="font-medium">{formatPHP(data?.otherRevenue || 0)}</span>
            </div>
          )}
          {(spoilageData?.lostRevenue || 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>🥛 Milk Rejected (Lost Revenue)</span>
              <span className="font-medium text-destructive">
                -{formatPHP(spoilageData?.lostRevenue || 0)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground border-t pt-2">
            <span>📈 Herd Value Growth</span>
            <span
              className={`font-medium ${
                (data?.unrealizedGain || 0) >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {(data?.unrealizedGain || 0) >= 0 ? "+" : ""}
              {formatPHP(data?.unrealizedGain || 0)}
            </span>
          </div>
        </div>

        {/* Insight Text */}
        <div
          className={`mt-4 p-3 rounded-lg ${
            isProfitable
              ? "bg-success-soft/60 border border-success/20"
              : "bg-destructive/5 border border-destructive/20"
          }`}
        >
          <p className="text-sm">
            {isProfitable ? "✅" : "⚠️"}{" "}
            <span className="font-medium">
              You spent {formatPHP(data?.operationalCosts || 0)} this period.
            </span>{" "}
            {(data?.unrealizedGain || 0) > 0 && (
              <>
                Your herd grew by{" "}
                <span className="font-medium text-success">
                  {formatPHP(data?.unrealizedGain || 0)}
                </span>{" "}
                in value
                {(data?.milkRevenue || 0) > 0 && (
                  <>
                    {" "}
                    and you sold{" "}
                    <span className="font-medium text-success">
                      {formatPHP(data?.milkRevenue || 0)}
                    </span>{" "}
                    in milk
                  </>
                )}
                .
              </>
            )}
            {(data?.unrealizedGain || 0) <= 0 && (data?.milkRevenue || 0) > 0 && (
              <>
                You earned{" "}
                <span className="font-medium text-success">
                  {formatPHP(data?.milkRevenue || 0)}
                </span>{" "}
                from milk sales.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

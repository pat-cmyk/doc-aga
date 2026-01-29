import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProfitability } from "@/hooks/useProfitability";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface DateRange {
  start: Date;
  end: Date;
}

interface ProfitabilityThermometerProps {
  farmId: string;
  dateRange?: DateRange;
}

export function ProfitabilityThermometer({ farmId, dateRange }: ProfitabilityThermometerProps) {
  const { data, isLoading } = useProfitability(farmId, dateRange);
  const { isMobile, fontSize } = useResponsiveChart({ size: 'small' });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
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
              isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {netPosition >= 0 ? "+" : ""}
            {formatCurrency(netPosition)}
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
                formatter={(value: number) => [formatCurrency(value), ""]}
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
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Costs (Input)</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">
              {formatCurrency(data?.operationalCosts || 0)}
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Output</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {formatCurrency(data?.totalOutput || 0)}
            </p>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>💰 Cash Revenue (Milk Sales)</span>
            <span className="font-medium">{formatCurrency(data?.milkRevenue || 0)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>🐄 Animal Sales</span>
            <span className="font-medium">{formatCurrency(data?.animalSalesRevenue || 0)}</span>
          </div>
          {(data?.otherRevenue || 0) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>📦 Other Revenue</span>
              <span className="font-medium">{formatCurrency(data?.otherRevenue || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground border-t pt-2">
            <span>📈 Herd Value Growth</span>
            <span
              className={`font-medium ${
                (data?.unrealizedGain || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {(data?.unrealizedGain || 0) >= 0 ? "+" : ""}
              {formatCurrency(data?.unrealizedGain || 0)}
            </span>
          </div>
        </div>

        {/* Insight Text */}
        <div
          className={`mt-4 p-3 rounded-lg ${
            isProfitable
              ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          }`}
        >
          <p className="text-sm">
            {isProfitable ? "✅" : "⚠️"}{" "}
            <span className="font-medium">
              You spent {formatCurrency(data?.operationalCosts || 0)} this period.
            </span>{" "}
            {(data?.unrealizedGain || 0) > 0 && (
              <>
                Your herd grew by{" "}
                <span className="font-medium text-green-600">
                  {formatCurrency(data?.unrealizedGain || 0)}
                </span>{" "}
                in value
                {(data?.milkRevenue || 0) > 0 && (
                  <>
                    {" "}
                    and you sold{" "}
                    <span className="font-medium text-green-600">
                      {formatCurrency(data?.milkRevenue || 0)}
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
                <span className="font-medium text-green-600">
                  {formatCurrency(data?.milkRevenue || 0)}
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

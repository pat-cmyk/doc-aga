import { format, parseISO } from "date-fns";
import { Droplets, TrendingUp, TrendingDown, Users, Banknote, Wheat } from "lucide-react";

interface MilkChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: {
      date: string;
      rawDate: string;
      milkTotal: number;
      prevDayMilk?: number;
      animalsCount?: number;
      revenue?: number;
      feedTotalKg?: number;
      feedAnimalCount?: number;
    };
  }>;
  label?: string;
}

export const MilkChartTooltip = ({ active, payload }: MilkChartTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const milkTotal = data.milkTotal || 0;
  const prevDayMilk = data.prevDayMilk;
  const animalsCount = data.animalsCount || 0;
  const revenue = data.revenue || 0;
  const feedTotalKg = data.feedTotalKg || 0;
  const feedAnimalCount = data.feedAnimalCount || 0;

  // Calculate difference from previous day
  const diff = prevDayMilk !== undefined ? milkTotal - prevDayMilk : null;
  const isPositive = diff !== null && diff >= 0;

  // Feed-to-milk ratio
  const feedMilkRatio = milkTotal > 0 && feedTotalKg > 0
    ? (feedTotalKg / milkTotal).toFixed(1)
    : null;

  // Format the full date
  let formattedDate = data.date;
  try {
    if (data.rawDate) {
      formattedDate = format(parseISO(data.rawDate), "EEEE, MMMM d, yyyy");
    }
  } catch {
    // Keep the short format if parsing fails
  }

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="text-sm font-medium text-foreground mb-2 pb-2 border-b border-border">
        {formattedDate}
      </p>
      
      <div className="space-y-2">
        {/* Total Milk */}
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-chart-1" />
          <span className="text-sm text-muted-foreground">Milk:</span>
          <span className="text-sm font-semibold text-foreground ml-auto">
            {milkTotal.toFixed(1)} L
          </span>
        </div>

        {/* Feed Total */}
        {feedTotalKg > 0 && (
          <div className="flex items-center gap-2">
            <Wheat className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">Feed:</span>
            <span className="text-sm font-semibold text-foreground ml-auto">
              {feedTotalKg.toFixed(1)} kg
            </span>
          </div>
        )}

        {/* Feed-to-Milk Ratio */}
        {feedMilkRatio && (
          <div className="flex items-center gap-2 pl-6">
            <span className="text-xs text-muted-foreground">Feed:Milk ratio:</span>
            <span className="text-xs font-medium text-foreground ml-auto">
              {feedMilkRatio}:1
            </span>
          </div>
        )}

        {/* Comparison to previous day */}
        {diff !== null && (
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-muted-foreground">vs yesterday:</span>
            <span className={`text-sm font-medium ml-auto ${isPositive ? 'text-green-500' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}{diff.toFixed(1)} L
            </span>
          </div>
        )}

        {/* Animals milked */}
        {animalsCount > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Animals:</span>
            <span className="text-sm font-medium text-foreground ml-auto">
              {animalsCount} milked
              {feedAnimalCount > 0 && ` · ${feedAnimalCount} fed`}
            </span>
          </div>
        )}

        {/* Revenue if any */}
        {revenue > 0 && (
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Revenue:</span>
            <span className="text-sm font-medium text-green-500 ml-auto">
              ₱{revenue.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
        Click for details
      </p>
    </div>
  );
};

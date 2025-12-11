import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HeadcountTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  previousTotal?: number;
  stageCategories: {
    productive: string[];
    development: string[];
    breeding: string[];
  };
}

export const HeadcountTooltip = ({ 
  active, 
  payload, 
  label,
  previousTotal,
  stageCategories
}: HeadcountTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  // Calculate totals
  const currentTotal = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
  
  // Calculate by category
  const categoryTotals = {
    productive: 0,
    development: 0,
    breeding: 0
  };

  payload.forEach(entry => {
    const stage = entry.dataKey as string;
    if (stageCategories.productive.includes(stage)) {
      categoryTotals.productive += entry.value || 0;
    } else if (stageCategories.development.includes(stage)) {
      categoryTotals.development += entry.value || 0;
    } else if (stageCategories.breeding.includes(stage)) {
      categoryTotals.breeding += entry.value || 0;
    }
  });

  // Calculate change from previous month
  const change = previousTotal !== undefined ? currentTotal - previousTotal : null;
  const changePercent = previousTotal && previousTotal > 0 
    ? ((change || 0) / previousTotal * 100).toFixed(1)
    : null;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      
      <div className="space-y-2">
        {/* Total headcount */}
        <div className="flex items-center gap-2">
          <span className="text-lg">🐄</span>
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="font-bold text-foreground">{currentTotal} head</span>
        </div>

        {/* Change from previous */}
        {change !== null && (
          <div className="flex items-center gap-1 text-sm">
            {change > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+{change} vs prev</span>
                {changePercent && (
                  <span className="text-muted-foreground">({changePercent}%)</span>
                )}
              </>
            ) : change < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600">{change} vs prev</span>
                {changePercent && (
                  <span className="text-muted-foreground">({changePercent}%)</span>
                )}
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">No change</span>
              </>
            )}
          </div>
        )}

        {/* Category breakdown */}
        <div className="border-t border-border pt-2 mt-2 space-y-1">
          {categoryTotals.productive > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Productive:</span>
              <span className="font-medium text-foreground">{categoryTotals.productive}</span>
            </div>
          )}
          {categoryTotals.development > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Development:</span>
              <span className="font-medium text-foreground">{categoryTotals.development}</span>
            </div>
          )}
          {categoryTotals.breeding > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Breeding Stock:</span>
              <span className="font-medium text-foreground">{categoryTotals.breeding}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
        Click bar for details
      </p>
    </div>
  );
};

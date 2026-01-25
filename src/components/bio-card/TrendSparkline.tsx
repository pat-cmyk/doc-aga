import React from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SparklineData } from "@/hooks/useBioCardData";

interface TrendSparklineProps {
  data: SparklineData[];
  label: string;
  labelFilipino?: string;
  type: 'weight' | 'bcs' | 'milk';
  height?: number;
  onClick?: () => void;
  className?: string;
}

const typeColors: Record<string, string> = {
  weight: 'hsl(var(--primary))',
  bcs: 'hsl(142, 76%, 36%)', // green
  milk: 'hsl(221, 83%, 53%)', // blue
};

export function TrendSparkline({
  data,
  label,
  labelFilipino,
  type,
  height = 32,
  onClick,
  className,
}: TrendSparklineProps) {
  const chartData = data.map((d) => ({ value: d.value }));
  const color = typeColors[type] || 'hsl(var(--primary))';

  // Calculate trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let latestValue: number | null = null;
  
  if (data.length >= 2) {
    const first = data[0].value;
    const last = data[data.length - 1].value;
    latestValue = last;
    const change = ((last - first) / first) * 100;
    if (change > 5) trend = 'up';
    else if (change < -5) trend = 'down';
  } else if (data.length === 1) {
    latestValue = data[0].value;
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  const hasData = data.length > 0;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex flex-col p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left",
        onClick && "cursor-pointer",
        !onClick && "cursor-default",
        className
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground truncate">
          {label}
          {labelFilipino && <span className="hidden sm:inline"> ({labelFilipino})</span>}
        </span>
        {hasData && <TrendIcon className={cn("w-3 h-3 flex-shrink-0", trendColor)} />}
      </div>

      {hasData ? (
        <>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {latestValue !== null && (
            <span className="text-xs font-medium mt-1">
              {type === 'weight' && `${latestValue.toFixed(1)} kg`}
              {type === 'bcs' && `${latestValue.toFixed(1)}`}
              {type === 'milk' && `${latestValue.toFixed(1)} L`}
            </span>
          )}
        </>
      ) : (
        <div 
          className="flex items-center justify-center text-muted-foreground text-[10px]"
          style={{ height }}
        >
          No data
        </div>
      )}
    </button>
  );
}

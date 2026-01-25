import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import type { RadarChartData } from "@/hooks/useBioCardData";

interface PerformanceRadarProps {
  data: RadarChartData[];
  showBenchmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { height: 150, outerRadius: 50 },
  md: { height: 200, outerRadius: 70 },
  lg: { height: 280, outerRadius: 100 },
};

export function PerformanceRadar({
  data,
  showBenchmark = true,
  size = 'md',
  className,
}: PerformanceRadarProps) {
  const config = sizeConfig[size];

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground text-sm", className)} style={{ height: config.height }}>
        No performance data available
      </div>
    );
  }

  // Transform data for recharts
  const chartData = data.map((d) => ({
    subject: d.axis,
    subjectTagalog: d.axisTagalog,
    value: d.value,
    benchmark: d.benchmark,
    fullMark: 100,
  }));

  return (
    <div className={cn("w-full", className)} style={{ height: config.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius={config.outerRadius}
          data={chartData}
        >
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={({ x, y, payload }) => {
              const item = chartData.find((d) => d.subject === payload.value);
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={4}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize={10}
                  >
                    {payload.value}
                  </text>
                  {item && size !== 'sm' && (
                    <text
                      x={0}
                      y={12}
                      textAnchor="middle"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={8}
                      opacity={0.7}
                    >
                      ({item.subjectTagalog})
                    </text>
                  )}
                </g>
              );
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
            tickCount={5}
          />

          {/* Benchmark area (if enabled) */}
          {showBenchmark && (
            <Radar
              name="Benchmark"
              dataKey="benchmark"
              stroke="hsl(var(--muted-foreground))"
              fill="hsl(var(--muted))"
              fillOpacity={0.3}
              strokeDasharray="4 4"
            />
          )}

          {/* Actual performance */}
          <Radar
            name="Performance"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.4}
            strokeWidth={2}
          />

          {size !== 'sm' && (
            <Legend
              wrapperStyle={{ fontSize: 10 }}
              iconSize={8}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

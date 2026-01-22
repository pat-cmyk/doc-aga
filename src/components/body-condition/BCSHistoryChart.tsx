import { useMemo } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Scale, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBodyConditionScores } from "@/hooks/useBodyConditionScores";
import { cn } from "@/lib/utils";
import { RecordBCSDialog } from "./RecordBCSDialog";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface BCSHistoryChartProps {
  animalId: string;
  farmId?: string;
  className?: string;
}

const zones = [
  { y1: 1, y2: 2, fill: "hsl(var(--destructive) / 0.15)", label: "Critical (Under)" },
  { y1: 2, y2: 2.5, fill: "hsl(38 92% 50% / 0.15)", label: "Warning (Thin)" },
  { y1: 2.5, y2: 3.5, fill: "hsl(142 76% 36% / 0.15)", label: "Ideal" },
  { y1: 3.5, y2: 4, fill: "hsl(38 92% 50% / 0.15)", label: "Warning (Over)" },
  { y1: 4, y2: 5, fill: "hsl(var(--destructive) / 0.15)", label: "Critical (Obese)" },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      score: number;
      notes?: string | null;
    };
  }>;
  getBCSStatus: (score: number) => { status: string; label: string; color: string };
}

const CustomTooltip = ({ active, payload, getBCSStatus }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const status = getBCSStatus(data.score);

  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg">
      <p className="text-sm text-muted-foreground">{data.date}</p>
      <p className={cn("text-lg font-bold", status.color)}>
        BCS: {data.score.toFixed(1)} - {status.label}
      </p>
      {data.notes && (
        <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">{data.notes}</p>
      )}
    </div>
  );
};

export function BCSHistoryChart({ animalId, farmId, className }: BCSHistoryChartProps) {
  const { isMobile, fontSize, xAxisProps } = useResponsiveChart({ size: 'small' });
  const { bcsRecords, isLoading, latestBCS, getBCSStatus } = useBodyConditionScores(animalId);

  const chartData = useMemo(() => {
    return [...bcsRecords]
      .reverse()
      .map((record) => ({
        date: format(new Date(record.assessment_date), "MMM dd"),
        fullDate: format(new Date(record.assessment_date), "MMM dd, yyyy"),
        score: record.score,
        notes: record.notes,
      }));
  }, [bcsRecords]);

  const previousBCS = bcsRecords[1] || null;
  const scoreChange = latestBCS && previousBCS ? latestBCS.score - previousBCS.score : null;

  const currentStatus = latestBCS ? getBCSStatus(latestBCS.score) : null;

  // Shared header with Record BCS button
  const renderHeader = () => (
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        <Scale className="h-5 w-5 text-purple-500" />
        Body Condition Score
      </CardTitle>
      {farmId && (
        <RecordBCSDialog
          animalId={animalId}
          farmId={farmId}
          trigger={
            <Button size="sm" className="gap-1.5 min-h-[40px]">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Record BCS</span>
              <span className="sm:hidden">BCS</span>
            </Button>
          }
        />
      )}
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card className={className}>
        {renderHeader()}
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading BCS data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bcsRecords.length === 0) {
    return (
      <Card className={className}>
        {renderHeader()}
        <CardContent>
          <div className="h-[150px] flex flex-col items-center justify-center text-center">
            <Scale className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No BCS records yet</p>
            <p className="text-sm text-muted-foreground/70">
              Record the first body condition score to start tracking
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {renderHeader()}
      <CardContent className="space-y-4">
        {/* Current BCS Summary */}
        {latestBCS && currentStatus && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Current BCS</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-3xl font-bold", currentStatus.color)}>
                  {latestBCS.score.toFixed(1)}
                </span>
                <Badge
                  variant={
                    currentStatus.status === "good"
                      ? "default"
                      : currentStatus.status === "warning"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {currentStatus.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(latestBCS.assessment_date), "MMM dd, yyyy")}
              </p>
            </div>

            {scoreChange !== null && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Change</p>
                <div
                  className={cn(
                    "flex items-center gap-1 text-lg font-semibold",
                    scoreChange > 0
                      ? "text-green-600"
                      : scoreChange < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {scoreChange > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : scoreChange < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {scoreChange > 0 ? "+" : ""}
                  {scoreChange.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  from {previousBCS?.score.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 1 && (
          <div className={cn("w-full", isMobile ? "h-[220px]" : "h-[240px]")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: isMobile ? 30 : 10 }}
              >
                {/* Color-coded zones */}
                {zones.map((zone, index) => (
                  <ReferenceArea
                    key={index}
                    y1={zone.y1}
                    y2={zone.y2}
                    fill={zone.fill}
                    fillOpacity={1}
                  />
                ))}

                <XAxis
                  dataKey="date"
                  tick={{ fontSize }}
                  tickMargin={xAxisProps.tickMargin}
                  angle={xAxisProps.angle}
                  textAnchor={xAxisProps.textAnchor}
                  height={isMobile ? 40 : 25}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip getBCSStatus={getBCSStatus} />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(270 60% 50%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(270 60% 50%)", strokeWidth: 2, r: isMobile ? 3 : 4 }}
                  activeDot={{ r: isMobile ? 5 : 6, fill: "hsl(270 60% 50%)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50" />
            <span className="text-muted-foreground">Ideal (2.5-3.5)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-yellow-500/30 border border-yellow-500/50" />
            <span className="text-muted-foreground">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-destructive/30 border border-destructive/50" />
            <span className="text-muted-foreground">Critical</span>
          </div>
        </div>

        {/* History Table */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">BCS History</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {bcsRecords.map((record) => {
              const status = getBCSStatus(record.score);
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {format(new Date(record.assessment_date), "MMM dd, yyyy")}
                    </span>
                    <span className={cn("font-medium", status.color)}>
                      {record.score.toFixed(1)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        status.status === "good" && "border-green-500/50 text-green-600",
                        status.status === "warning" && "border-yellow-500/50 text-yellow-600",
                        status.status === "critical" && "border-destructive/50 text-destructive"
                      )}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  {record.notes && (
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {record.notes}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

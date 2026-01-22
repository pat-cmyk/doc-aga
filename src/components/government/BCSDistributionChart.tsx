import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { GovernmentHealthStats } from "@/hooks/useGovernmentHealthStats";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { CHART_LEGEND } from "@/lib/chartConfig";

interface BCSDistributionChartProps {
  stats: GovernmentHealthStats | null;
  isLoading: boolean;
}

export function BCSDistributionChart({ stats, isLoading }: BCSDistributionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const underweight = stats?.animals_underweight || 0;
  const optimal = stats?.animals_optimal || 0;
  const overweight = stats?.animals_overweight || 0;
  const totalAssessments = stats?.bcs_assessments_count || 0;
  const avgScore = stats?.avg_bcs_score || 0;

  const chartData = [
    { name: 'Underweight (<2.5)', value: underweight, color: 'hsl(var(--destructive))' },
    { name: 'Optimal (2.5-4.0)', value: optimal, color: 'hsl(var(--primary))' },
    { name: 'Overweight (>4.0)', value: overweight, color: 'hsl(38, 92%, 50%)' },
  ].filter(item => item.value > 0);

  const hasData = chartData.length > 0;

  const getBCSStatusColor = (score: number) => {
    if (score < 2.5) return "text-destructive";
    if (score <= 4.0) return "text-primary";
    return "text-yellow-600";
  };

  const getBCSStatus = (score: number) => {
    if (score < 2.5) return "Below Target";
    if (score <= 4.0) return "Optimal Range";
    return "Above Target";
  };

  const isMobile = useIsMobile();
  const legendConfig = isMobile ? CHART_LEGEND.mobile : CHART_LEGEND.desktop;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Body Condition Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average BCS */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground">Average BCS</p>
            <p className={`text-2xl font-bold ${getBCSStatusColor(avgScore)}`}>
              {avgScore.toFixed(2)}
            </p>
            <p className={`text-xs ${getBCSStatusColor(avgScore)}`}>
              {getBCSStatus(avgScore)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Assessments</p>
            <p className="text-lg font-semibold">{totalAssessments}</p>
          </div>
        </div>

        {/* Distribution Chart */}
        {hasData ? (
          <div className={isMobile ? "h-56" : "h-48"}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 35 : 40}
                  outerRadius={isMobile ? 60 : 70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} animals`, '']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={isMobile ? 48 : 36}
                  wrapperStyle={{ fontSize: legendConfig.fontSize }}
                  iconSize={legendConfig.iconSize}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={`${isMobile ? "h-56" : "h-48"} flex items-center justify-center text-muted-foreground`}>
            No BCS data available
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-destructive/10">
            <AlertTriangle className="h-3 w-3 mx-auto text-destructive mb-1" />
            <p className="font-medium text-destructive">{underweight}</p>
            <p className="text-muted-foreground">Underweight</p>
          </div>
          <div className="p-2 rounded bg-primary/10">
            <CheckCircle className="h-3 w-3 mx-auto text-primary mb-1" />
            <p className="font-medium text-primary">{optimal}</p>
            <p className="text-muted-foreground">Optimal</p>
          </div>
          <div className="p-2 rounded bg-yellow-500/10">
            <TrendingUp className="h-3 w-3 mx-auto text-yellow-600 mb-1" />
            <p className="font-medium text-yellow-600">{overweight}</p>
            <p className="text-muted-foreground">Overweight</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

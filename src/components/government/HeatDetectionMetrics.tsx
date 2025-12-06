import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, Clock, Target, Activity } from "lucide-react";
import { GovernmentHealthStats } from "@/hooks/useGovernmentHealthStats";

interface HeatDetectionMetricsProps {
  stats: GovernmentHealthStats | null;
  isLoading: boolean;
}

export function HeatDetectionMetrics({ stats, isLoading }: HeatDetectionMetricsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const heatEvents = stats?.heat_events_count || 0;
  const avgCycleLength = stats?.avg_cycle_length_days || 0;
  const animalsInWindow = stats?.animals_in_optimal_window || 0;

  // Expected cycle length for cattle/carabao is ~21 days
  const expectedCycleLength = 21;
  const cycleVariance = avgCycleLength > 0 
    ? Math.abs(avgCycleLength - expectedCycleLength) 
    : 0;

  const getCycleStatus = () => {
    if (avgCycleLength === 0) return { text: "No data", color: "text-muted-foreground" };
    if (cycleVariance <= 2) return { text: "Normal", color: "text-green-600" };
    if (cycleVariance <= 5) return { text: "Slight variance", color: "text-yellow-600" };
    return { text: "High variance", color: "text-red-600" };
  };

  const cycleStatus = getCycleStatus();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Thermometer className="h-4 w-4 text-primary" />
          Heat Detection Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Heat Events */}
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <Activity className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{heatEvents}</p>
            <p className="text-xs text-muted-foreground">Heat Events</p>
          </div>

          {/* Average Cycle Length */}
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <Clock className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">
              {avgCycleLength > 0 ? avgCycleLength.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Avg Cycle (days)</p>
            <p className={`text-xs ${cycleStatus.color}`}>{cycleStatus.text}</p>
          </div>

          {/* Animals in Optimal Window */}
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <Target className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600">{animalsInWindow}</p>
            <p className="text-xs text-muted-foreground">Ready for AI</p>
            <p className="text-xs text-green-600">Optimal window</p>
          </div>
        </div>

        {/* Info Footer */}
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Normal estrous cycle for cattle and carabao is approximately 21 days. 
            Animals in "optimal window" are currently in standing heat and ready for artificial insemination.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

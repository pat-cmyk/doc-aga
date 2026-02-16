import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendIndicator } from "@/components/farm-dashboard/TrendIndicator";
import { useMilkSpoilageReport } from "@/hooks/useMilkSpoilageReport";
import { formatPHP } from "@/lib/currency";
import { Droplets, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRange {
  start: Date;
  end: Date;
}

interface MilkSpoilageCardProps {
  farmId: string;
  dateRange?: DateRange;
}

export function MilkSpoilageCard({ farmId, dateRange }: MilkSpoilageCardProps) {
  const { data, isLoading } = useMilkSpoilageReport(farmId, dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalLiters === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Milk Quality Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No milking records for this period yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    excellent: { label: '<2%', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    attention: { label: '2-5%', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    critical: { label: '>5%', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  const config = statusConfig[data.status];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Milk Quality Report</CardTitle>
          </div>
          <Badge className={cn("text-xs", config.color)}>
            {data.rejectionRate.toFixed(1)}% rejected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-lg font-bold">{data.rejectedLiters.toFixed(1)} L</p>
            <p className="text-xs text-muted-foreground">of {data.totalLiters.toFixed(1)} L total</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-600 dark:text-red-400">Lost Revenue</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatPHP(data.lostRevenue)}</p>
            <TrendIndicator
              current={data.rejectionRate}
              previous={data.previousRejectionRate}
              positiveIsGood={false}
            />
          </div>
        </div>

        {/* Rejection Reasons */}
        {data.reasonBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Top Rejection Reasons</p>
            {data.reasonBreakdown.slice(0, 4).map((reason) => (
              <div key={reason.reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[160px]">
                    {reason.label.split(' / ')[0]}
                  </span>
                  <span className="font-medium">{reason.liters.toFixed(1)} L ({reason.count}x)</span>
                </div>
                <Progress
                  value={reason.percentage}
                  className="h-1.5 [&>div]:bg-red-500"
                />
              </div>
            ))}
          </div>
        )}

        {/* Top Affected Animals */}
        {data.topRejectedAnimals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Animals to Watch
            </p>
            <div className="space-y-1.5">
              {data.topRejectedAnimals.slice(0, 3).map((animal) => (
                <div key={animal.animalId} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="font-medium">{animal.animalName}</span>
                  <span className="text-muted-foreground">
                    {animal.rejectionCount}x • {animal.litersLost.toFixed(1)} L lost
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

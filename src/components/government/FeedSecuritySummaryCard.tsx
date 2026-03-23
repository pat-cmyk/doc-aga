import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRegionalFeedSecurity } from "@/hooks/useRegionalFeedSecurity";
import { Wheat } from "lucide-react";
import { DataCategory } from "@/types/government";

interface FeedSecuritySummaryCardProps {
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;
}

export const FeedSecuritySummaryCard = ({
  region,
  province,
  municipality,
  dataCategory = "live",
}: FeedSecuritySummaryCardProps) => {
  const { data, isLoading } = useRegionalFeedSecurity(region, province, municipality, dataCategory);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  const totalFarms = data?.totalFarms ?? 0;
  const criticalPct = data?.overallCriticalPercentage ?? 0;
  const lowPct = data?.overallLowPercentage ?? 0;
  const adequatePct = totalFarms > 0 ? Math.max(0, 100 - criticalPct - lowPct) : 0;

  // Compute avg stock days across regions
  const avgDays = data?.regions && data.regions.length > 0
    ? data.regions.reduce((sum, r) => sum + (r.avg_feed_stock_days ?? 0), 0) / data.regions.length
    : 0;

  const statusColor = criticalPct > 30 ? "destructive" : criticalPct > 10 ? "warning" : "default";
  const statusLabel = criticalPct > 30 ? "Critical" : criticalPct > 10 ? "Warning" : "Adequate";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wheat className="h-4 w-4 text-amber-600" />
          Feed Security
          <Badge variant={statusColor === "warning" ? "outline" : statusColor === "destructive" ? "destructive" : "secondary"} className="ml-auto text-[10px] h-5">
            {statusLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">
            {avgDays > 0 ? `${Math.round(avgDays)} days` : "No data"}
          </div>
          <div className="text-xs text-muted-foreground">
            Avg. feed stock remaining ({totalFarms} farms)
          </div>
        </div>

        {totalFarms > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {criticalPct > 0 && (
                <div className="bg-red-500" style={{ width: `${criticalPct}%` }} title={`Critical: ${criticalPct.toFixed(0)}%`} />
              )}
              {lowPct > 0 && (
                <div className="bg-amber-500" style={{ width: `${lowPct}%` }} title={`Low: ${lowPct.toFixed(0)}%`} />
              )}
              {adequatePct > 0 && (
                <div className="bg-green-500" style={{ width: `${adequatePct}%` }} title={`Adequate: ${adequatePct.toFixed(0)}%`} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical {criticalPct.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Low {lowPct.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Adequate {adequatePct.toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

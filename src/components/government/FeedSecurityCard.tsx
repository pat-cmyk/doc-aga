import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useRegionalFeedSecurity } from "@/hooks/useRegionalFeedSecurity";
import { AlertTriangle, CheckCircle, Wheat, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedSecurityCardProps {
  region?: string;
  province?: string;
  municipality?: string;
}

export const FeedSecurityCard = ({
  region,
  province,
  municipality,
}: FeedSecurityCardProps) => {
  const { data, isLoading, error } = useRegionalFeedSecurity(
    region,
    province,
    municipality
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load feed security data.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalFarms === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-primary" />
            <CardTitle>Feed Security Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No feed inventory data available.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (criticalPct: number, lowPct: number) => {
    if (criticalPct >= 20) return "destructive";
    if (criticalPct >= 10 || lowPct >= 30) return "warning";
    return "success";
  };

  const overallStatus = getStatusColor(data.overallCriticalPercentage, data.overallLowPercentage);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-primary" />
            <CardTitle>Feed Security Status</CardTitle>
          </div>
          <Badge
            variant={overallStatus === "success" ? "default" : overallStatus === "warning" ? "secondary" : "destructive"}
            className={cn(
              overallStatus === "success" && "bg-green-500/10 text-green-600 border-green-500/20",
              overallStatus === "warning" && "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            )}
          >
            {overallStatus === "success" ? "Healthy" : overallStatus === "warning" ? "Caution" : "Alert"}
          </Badge>
        </div>
        <CardDescription>
          Regional feed availability and early warning indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Critical</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{data.criticalFarms}</div>
            <div className="text-xs text-muted-foreground">&lt;7 days feed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Low</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{data.lowFarms}</div>
            <div className="text-xs text-muted-foreground">7-30 days feed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Adequate</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{data.adequateFarms}</div>
            <div className="text-xs text-muted-foreground">&gt;30 days feed</div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Feed Security Index</span>
            <span className="font-medium">
              {(100 - data.overallCriticalPercentage - data.overallLowPercentage).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            <div 
              className="bg-green-500 transition-all" 
              style={{ width: `${(data.adequateFarms / data.totalFarms) * 100}%` }}
            />
            <div 
              className="bg-yellow-500 transition-all" 
              style={{ width: `${(data.lowFarms / data.totalFarms) * 100}%` }}
            />
            <div 
              className="bg-red-500 transition-all" 
              style={{ width: `${(data.criticalFarms / data.totalFarms) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{data.totalFarms} farms monitored</span>
            <span>{data.overallCriticalPercentage.toFixed(1)}% critical</span>
          </div>
        </div>

        {/* Regional Breakdown */}
        {data.regions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Regional Breakdown</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {data.regions.slice(0, 10).map((r, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg border",
                    r.critical_percentage >= 20 && "bg-red-500/5 border-red-500/20",
                    r.critical_percentage < 20 && r.low_percentage >= 30 && "bg-yellow-500/5 border-yellow-500/20"
                  )}
                >
                  <div>
                    <div className="font-medium text-sm">{r.region}</div>
                    {r.province && (
                      <div className="text-xs text-muted-foreground">{r.province}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {r.avg_feed_stock_days?.toFixed(0) || "—"} days avg
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.critical_feed_farms} critical / {r.total_farms} farms
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

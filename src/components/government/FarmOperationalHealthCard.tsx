import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useFarmComplianceMetrics } from "@/hooks/useFarmComplianceMetrics";
import { ClipboardCheck, CheckCircle2, AlertCircle, Droplets, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

interface FarmOperationalHealthCardProps {
  startDate: Date;
  endDate: Date;
  region?: string;
  province?: string;
}

export const FarmOperationalHealthCard = ({
  startDate,
  endDate,
  region,
  province,
}: FarmOperationalHealthCardProps) => {
  const { data, isLoading, error } = useFarmComplianceMetrics(
    startDate,
    endDate,
    region,
    province
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
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load compliance metrics.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalFarms === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle>Operational Compliance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No compliance data available.</p>
        </CardContent>
      </Card>
    );
  }

  const complianceColor =
    data.overallComplianceRate >= 70
      ? "text-green-600"
      : data.overallComplianceRate >= 40
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <CardTitle>Operational Compliance</CardTitle>
        </div>
        <CardDescription>
          Farm activity logging and data quality indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Compliance Score */}
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <div className="text-sm text-muted-foreground mb-1">Overall Compliance Rate</div>
          <div className={cn("text-4xl font-bold", complianceColor)}>
            {data.overallComplianceRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {data.highComplianceFarms} high / {data.lowComplianceFarms} low / {data.totalFarms} total farms
          </div>
        </div>

        {/* Activity Completion Rates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Droplets className="h-4 w-4" />
              Milking Logs
            </div>
            <div className="text-xl font-semibold mb-1">
              {data.avgMilkingCompletion.toFixed(1)}%
            </div>
            <Progress value={data.avgMilkingCompletion} className="h-2" />
          </div>
          <div className="p-3 rounded-lg border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Utensils className="h-4 w-4" />
              Feeding Logs
            </div>
            <div className="text-xl font-semibold mb-1">
              {data.avgFeedingCompletion.toFixed(1)}%
            </div>
            <Progress value={data.avgFeedingCompletion} className="h-2" />
          </div>
        </div>

        {/* Regional Breakdown */}
        {data.regions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Regional Compliance</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {data.regions.slice(0, 10).map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg border"
                >
                  <div>
                    <div className="font-medium text-sm">{r.region}</div>
                    {r.province && (
                      <div className="text-xs text-muted-foreground">{r.province}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {r.compliance_rate.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.farms_with_milking_logs}/{r.total_farms} logging
                      </div>
                    </div>
                    {r.compliance_rate >= 70 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : r.compliance_rate >= 40 ? (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
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

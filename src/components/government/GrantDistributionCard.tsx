import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, TrendingUp } from "lucide-react";
import { useGrantAnalytics } from "@/hooks/useGrantAnalytics";

interface GrantDistributionCardProps {
  region?: string;
  province?: string;
  municipality?: string;
}

export function GrantDistributionCard({ region, province, municipality }: GrantDistributionCardProps) {
  const { data, isLoading } = useGrantAnalytics(region, province, municipality);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4" />
          Grant Program Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-300">Grant Recipients</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              {data.totalGrantAnimals.toLocaleString()}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs">
              {data.grantPercentage.toFixed(1)}% of herd
            </Badge>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">Purchased Animals</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {data.totalPurchasedAnimals.toLocaleString()}
            </p>
            {data.avgPurchasePrice > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Avg: ₱{data.avgPurchasePrice.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Grant Source Breakdown */}
        {data.grantSourceBreakdown.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">By Grant Source</p>
            <div className="space-y-2">
              {data.grantSourceBreakdown.map((source) => (
                <div
                  key={source.grantSource}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm">{source.grantSource}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{source.count}</span>
                    <Badge variant="outline" className="text-xs">
                      {source.percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acquisition Breakdown Chart */}
        <div>
          <p className="text-sm font-medium mb-2">Acquisition Overview</p>
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            {data.acquisitionBreakdown.purchased > 0 && (
              <div
                className="bg-blue-500 h-full"
                style={{
                  width: `${(data.acquisitionBreakdown.purchased / data.acquisitionBreakdown.total) * 100}%`,
                }}
                title={`Purchased: ${data.acquisitionBreakdown.purchased}`}
              />
            )}
            {data.acquisitionBreakdown.grant > 0 && (
              <div
                className="bg-green-500 h-full"
                style={{
                  width: `${(data.acquisitionBreakdown.grant / data.acquisitionBreakdown.total) * 100}%`,
                }}
                title={`Grant: ${data.acquisitionBreakdown.grant}`}
              />
            )}
            {data.acquisitionBreakdown.bornOnFarm > 0 && (
              <div
                className="bg-amber-500 h-full"
                style={{
                  width: `${(data.acquisitionBreakdown.bornOnFarm / data.acquisitionBreakdown.total) * 100}%`,
                }}
                title={`Born on Farm: ${data.acquisitionBreakdown.bornOnFarm}`}
              />
            )}
            {data.acquisitionBreakdown.unknown > 0 && (
              <div
                className="bg-gray-400 h-full"
                style={{
                  width: `${(data.acquisitionBreakdown.unknown / data.acquisitionBreakdown.total) * 100}%`,
                }}
                title={`Unknown: ${data.acquisitionBreakdown.unknown}`}
              />
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Purchased ({data.acquisitionBreakdown.purchased})</span>
            <span>Grant ({data.acquisitionBreakdown.grant})</span>
            <span>Born ({data.acquisitionBreakdown.bornOnFarm})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

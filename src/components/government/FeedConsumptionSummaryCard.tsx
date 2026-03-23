import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useGovernmentFeedConsumption } from "@/hooks/useGovernmentFeedConsumption";
import { Wheat, ArrowRightLeft } from "lucide-react";
import { DataCategory } from "@/types/government";

interface FeedConsumptionSummaryCardProps {
  startDate: Date;
  endDate: Date;
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;
  totalMilkLiters?: number;
}

/**
 * Feed-to-milk ratio (FCR) color coding based on dairy industry benchmarks.
 * Lower FCR = more efficient. Typical range: 0.8-3.0 kg feed per liter milk.
 */
function getFcrStatus(fcr: number): { label: string; color: string } {
  if (fcr <= 1.5) return { label: "Efficient", color: "text-green-600" };
  if (fcr <= 2.5) return { label: "Average", color: "text-amber-600" };
  return { label: "High", color: "text-red-600" };
}

export const FeedConsumptionSummaryCard = ({
  startDate,
  endDate,
  region,
  province,
  municipality,
  dataCategory = "live",
  totalMilkLiters,
}: FeedConsumptionSummaryCardProps) => {
  const { data, isLoading } = useGovernmentFeedConsumption(
    startDate,
    endDate,
    region,
    province,
    municipality,
    dataCategory
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalFeedKg = data?.totalFeedKg ?? 0;
  const avgDailyKg = data?.avgDailyFeedKg ?? 0;
  const farmsReporting = data?.totalFarmsFeeding ?? 0;

  // Feed-to-Milk Conversion Ratio
  const hasFcr = totalFeedKg > 0 && (totalMilkLiters ?? 0) > 0;
  const fcr = hasFcr ? totalFeedKg / totalMilkLiters! : null;
  const fcrStatus = fcr !== null ? getFcrStatus(fcr) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wheat className="h-4 w-4 text-amber-600" />
          Feed Consumption
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">
            {totalFeedKg > 0
              ? `${totalFeedKg.toLocaleString("en-PH", { maximumFractionDigits: 0 })} kg`
              : "No data"}
          </div>
          {avgDailyKg > 0 && (
            <div className="text-xs text-muted-foreground">
              Avg. {avgDailyKg.toLocaleString("en-PH", { maximumFractionDigits: 0 })} kg/day
              {farmsReporting > 0 && ` · ${farmsReporting} farms`}
            </div>
          )}
        </div>

        {/* Feed-to-Milk Ratio */}
        {fcr !== null && fcrStatus && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Feed-to-Milk Ratio</div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${fcrStatus.color}`}>
                  {fcr.toFixed(1)} kg/L
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] h-4 px-1.5 ${fcrStatus.color} border-current`}
                >
                  {fcrStatus.label}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {totalFeedKg === 0 && (totalMilkLiters ?? 0) > 0 && (
          <div className="text-[10px] text-muted-foreground">
            No feed records found for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
};

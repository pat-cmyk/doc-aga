import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGovernmentMilkAnalytics } from "@/hooks/useGovernmentMilkAnalytics";
import { Droplets, TrendingUp } from "lucide-react";
import { DataCategory } from "@/types/government";
import { formatPHPCompact } from "@/lib/currency";

interface MilkProductionSummaryCardProps {
  startDate: Date;
  endDate: Date;
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;
}

export const MilkProductionSummaryCard = ({
  startDate,
  endDate,
  region,
  province,
  municipality,
  dataCategory = "live",
}: MilkProductionSummaryCardProps) => {
  const { data, isLoading } = useGovernmentMilkAnalytics(
    startDate, endDate, region, province, municipality, dataCategory
  );

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

  const totalMilk = data?.totalMilk ?? 0;
  const cattlePct = totalMilk > 0 ? ((data?.totalCattleMilk ?? 0) / totalMilk) * 100 : 0;
  const goatPct = totalMilk > 0 ? ((data?.totalGoatMilk ?? 0) / totalMilk) * 100 : 0;
  const carabaoPct = totalMilk > 0 ? ((data?.totalCarabaoMilk ?? 0) / totalMilk) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-500" />
          Milk Production
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-2xl font-bold">
            {totalMilk > 0 ? `${totalMilk.toLocaleString("en-PH", { maximumFractionDigits: 0 })} L` : "No data"}
          </div>
          {data?.totalRevenueEstimate ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Est. revenue: {formatPHPCompact(data.totalRevenueEstimate)}
            </div>
          ) : null}
        </div>

        {totalMilk > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {cattlePct > 0 && (
                <div className="bg-amber-500" style={{ width: `${cattlePct}%` }} title={`Cattle: ${cattlePct.toFixed(0)}%`} />
              )}
              {goatPct > 0 && (
                <div className="bg-emerald-500" style={{ width: `${goatPct}%` }} title={`Goat: ${goatPct.toFixed(0)}%`} />
              )}
              {carabaoPct > 0 && (
                <div className="bg-blue-500" style={{ width: `${carabaoPct}%` }} title={`Carabao: ${carabaoPct.toFixed(0)}%`} />
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              {cattlePct > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Cattle {cattlePct.toFixed(0)}%
                </span>
              )}
              {goatPct > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Goat {goatPct.toFixed(0)}%
                </span>
              )}
              {carabaoPct > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Carabao {carabaoPct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

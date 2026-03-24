import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MilkProductionSummaryCard } from "./MilkProductionSummaryCard";
import { FeedConsumptionSummaryCard } from "./FeedConsumptionSummaryCard";
import { useGovernmentMilkAnalytics } from "@/hooks/useGovernmentMilkAnalytics";
import { DataCategory } from "@/types/government";

const RegionalLivestockMap = lazy(() => import("./RegionalLivestockMap"));

interface MapWithSummaryPanelProps {
  dateRange: { start: Date; end: Date };
  dataCategory: DataCategory;
  region?: string;
  province?: string;
  municipality?: string;
  onRegionSelect: (region: string | undefined) => void;
}

export const MapWithSummaryPanel = ({
  dateRange,
  dataCategory,
  region,
  province,
  municipality,
  onRegionSelect,
}: MapWithSummaryPanelProps) => {
  // Fetch milk total at this level so it can be shared with FeedConsumptionSummaryCard for FCR
  const { data: milkData } = useGovernmentMilkAnalytics(
    dateRange.start,
    dateRange.end,
    region,
    province,
    municipality,
    dataCategory
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Map (2/3 width on desktop) */}
      <div className="lg:col-span-2">
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Regional Livestock Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full h-[450px] rounded-lg" />
              </CardContent>
            </Card>
          }
        >
          <RegionalLivestockMap
            dateRange={dateRange}
            dataCategory={dataCategory}
            region={region}
            province={province}
            onRegionSelect={onRegionSelect}
          />
        </Suspense>
      </div>

      {/* Summary sidebar (1/3 width on desktop) */}
      <div className="space-y-4">
        <MilkProductionSummaryCard
          startDate={dateRange.start}
          endDate={dateRange.end}
          region={region}
          province={province}
          municipality={municipality}
          dataCategory={dataCategory}
        />
        <FeedConsumptionSummaryCard
          startDate={dateRange.start}
          endDate={dateRange.end}
          region={region}
          province={province}
          municipality={municipality}
          dataCategory={dataCategory}
          totalMilkLiters={milkData?.totalMilk}
        />
      </div>
    </div>
  );
};

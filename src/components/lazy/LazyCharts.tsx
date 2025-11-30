import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Lazy load chart components to reduce initial bundle size
const MilkProductionChart = lazy(() => 
  import("@/components/farm-dashboard/MilkProductionChart").then(module => ({
    default: module.MilkProductionChart
  }))
);

const HeadcountChart = lazy(() => 
  import("@/components/farm-dashboard/HeadcountChart").then(module => ({
    default: module.HeadcountChart
  }))
);

// Chart skeleton for loading state
const ChartSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[300px] w-full" />
    </CardContent>
  </Card>
);

interface LazyMilkProductionChartProps {
  data: any[];
  timePeriod: "last30" | "ytd";
  selectedYear: number;
  onTimePeriodChange: (period: "last30" | "ytd") => void;
  onYearChange: (year: number) => void;
}

export const LazyMilkProductionChart = (props: LazyMilkProductionChartProps) => (
  <Suspense fallback={<ChartSkeleton />}>
    <MilkProductionChart {...props} />
  </Suspense>
);

interface LazyHeadcountChartProps {
  data: any[];
  stageKeys: string[];
  monthlyTimePeriod: "all" | "ytd";
  selectedYear: number;
  onMonthlyTimePeriodChange: (period: "all" | "ytd") => void;
  onYearChange: (year: number) => void;
}

export const LazyHeadcountChart = (props: LazyHeadcountChartProps) => (
  <Suspense fallback={<ChartSkeleton />}>
    <HeadcountChart {...props} />
  </Suspense>
);

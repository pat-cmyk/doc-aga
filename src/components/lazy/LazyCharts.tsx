import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LazyRenderOnVisible } from "./LazyRenderOnVisible";

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

// Chart skeleton for loading state with responsive heights
const MilkChartSkeleton = () => (
  <Card>
    <CardHeader className="space-y-2 pb-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[260px] sm:h-[320px] md:h-[360px] w-full" />
    </CardContent>
  </Card>
);

const HeadcountChartSkeleton = () => (
  <Card>
    <CardHeader className="space-y-2 pb-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[320px] sm:h-[360px] w-full" />
    </CardContent>
  </Card>
);

interface LazyMilkProductionChartProps {
  data: any[];
  timePeriod: "last30" | "ytd";
  selectedYear: number;
  onTimePeriodChange: (period: "last30" | "ytd") => void;
  onYearChange: (year: number) => void;
  farmId: string;
  averageMilk?: number;
}

export const LazyMilkProductionChart = (props: LazyMilkProductionChartProps) => (
  <LazyRenderOnVisible 
    fallback={<MilkChartSkeleton />}
    minHeight="440px"
    threshold={0.1}
    rootMargin="100px"
  >
    <Suspense fallback={<MilkChartSkeleton />}>
      <MilkProductionChart {...props} />
    </Suspense>
  </LazyRenderOnVisible>
);

interface LazyHeadcountChartProps {
  data: any[];
  stageKeys: string[];
  monthlyTimePeriod: "all" | "ytd";
  selectedYear: number;
  onMonthlyTimePeriodChange: (period: "all" | "ytd") => void;
  onYearChange: (year: number) => void;
  farmId: string;
  totalAnimals?: number;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const LazyHeadcountChart = (props: LazyHeadcountChartProps) => (
  <LazyRenderOnVisible 
    fallback={<HeadcountChartSkeleton />}
    minHeight="480px"
    threshold={0.1}
    rootMargin="100px"
  >
    <Suspense fallback={<HeadcountChartSkeleton />}>
      <HeadcountChart {...props} />
    </Suspense>
  </LazyRenderOnVisible>
);

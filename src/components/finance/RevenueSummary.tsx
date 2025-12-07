import { Coins, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRevenueSummary } from "@/hooks/useRevenues";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueSummaryProps {
  farmId: string;
}

export function RevenueSummary({ farmId }: RevenueSummaryProps) {
  const { data: summary, isLoading } = useRevenueSummary(farmId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const monthChange = summary.lastMonth > 0
    ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
          <Coins className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            ₱{summary.thisMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {monthChange > 0 ? "+" : ""}
            {monthChange.toFixed(1)}% from last month
          </p>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue This Year</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            ₱{summary.thisYear.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.topSource
              ? `Top source: ${summary.topSource.source}`
              : "Year-to-date earnings"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { DollarSign, TrendingUp, Package, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpenseSummary } from "@/hooks/useExpenses";
import { Skeleton } from "@/components/ui/skeleton";

interface ExpenseSummaryProps {
  farmId: string;
}

export function ExpenseSummary({ farmId }: ExpenseSummaryProps) {
  const { data: summary, isLoading } = useExpenseSummary(farmId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ₱{summary.thisMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            {monthChange > 0 ? "+" : ""}
            {monthChange.toFixed(1)}% from last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Year</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ₱{summary.thisYear.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Year-to-date spending</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.topCategory ? summary.topCategory.category : "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.topCategory
              ? `₱${summary.topCategory.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
              : "No expenses this month"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ₱{summary.averageDaily.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Average per day this month</p>
        </CardContent>
      </Card>
    </div>
  );
}

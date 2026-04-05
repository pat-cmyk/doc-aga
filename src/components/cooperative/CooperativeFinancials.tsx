import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useCooperativeFinancialSummary } from "@/hooks/useCooperative";
import { formatNumber } from "@/lib/currency";

interface Props {
  cooperativeId: string;
}

export const CooperativeFinancials = ({ cooperativeId }: Props) => {
  const { data: fin, isLoading } = useCooperativeFinancialSummary(cooperativeId, 30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const netIncome = (fin?.total_revenue ?? 0) - (fin?.total_expenses ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Financials</h2>
        <p className="text-muted-foreground text-sm">Last 30 days</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{formatNumber(fin?.total_revenue ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{formatNumber(fin?.total_expenses ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>
              ₱{formatNumber(netIncome)}
            </div>
          </CardContent>
        </Card>
      </div>

      {fin?.revenue_by_farm && fin.revenue_by_farm.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Farm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fin.revenue_by_farm.map((f: any) => (
                <div key={f.farm_id} className="flex items-center justify-between text-sm">
                  <span>{f.farm_name}</span>
                  <span className="font-medium">₱{formatNumber(f.total ?? 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

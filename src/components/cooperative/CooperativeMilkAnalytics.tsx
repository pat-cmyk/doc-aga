import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useCooperativeMilkProduction } from "@/hooks/useCooperative";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatNumber } from "@/lib/currency";

interface Props {
  cooperativeId: string;
}

export const CooperativeMilkAnalytics = ({ cooperativeId }: Props) => {
  const { data: milk, isLoading } = useCooperativeMilkProduction(cooperativeId, 30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Milk Production</h2>
        <p className="text-muted-foreground text-sm">Last 30 days</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Total: {formatNumber(milk?.total_liters ?? 0)} liters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {milk?.daily && milk.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={milk.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(d) => new Date(d).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
                  formatter={(v: number) => [`${v.toFixed(1)} L`, "Production"]}
                />
                <Bar dataKey="liters" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No milk production data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Per-farm breakdown */}
      {milk?.by_farm && milk.by_farm.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production by Farm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milk.by_farm.map((f: any) => (
                <div key={f.farm_id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{f.farm_name}</span>
                  <span className="text-sm text-muted-foreground">{(f.total_liters ?? 0).toFixed(1)} L</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

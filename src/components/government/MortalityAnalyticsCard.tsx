import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Skull, ShoppingCart, Scissors, ArrowRightLeft, Beef, TrendingDown } from "lucide-react";
import { GovernmentHealthStats } from "@/hooks/useGovernmentHealthStats";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface MortalityAnalyticsCardProps {
  stats: GovernmentHealthStats | null;
  isLoading: boolean;
}

export function MortalityAnalyticsCard({ stats, isLoading }: MortalityAnalyticsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const exitData = [
    { name: 'Sold', value: stats?.exits_sold || 0, color: 'hsl(var(--primary))', icon: ShoppingCart },
    { name: 'Died', value: stats?.exits_died || 0, color: 'hsl(var(--destructive))', icon: Skull },
    { name: 'Culled', value: stats?.exits_culled || 0, color: 'hsl(38, 92%, 50%)', icon: Scissors },
    { name: 'Transferred', value: stats?.exits_transferred || 0, color: 'hsl(210, 79%, 46%)', icon: ArrowRightLeft },
    { name: 'Slaughtered', value: stats?.exits_slaughtered || 0, color: 'hsl(280, 65%, 60%)', icon: Beef },
  ].filter(item => item.value > 0);

  const totalExits = stats?.total_exits || 0;
  const mortalityRate = stats?.mortality_rate || 0;
  const salesRevenue = stats?.total_sales_revenue || 0;
  const hasData = exitData.length > 0;

  const getMortalityColor = (rate: number) => {
    if (rate <= 2) return "text-green-600";
    if (rate <= 5) return "text-yellow-600";
    return "text-destructive";
  };

  const getMortalityStatus = (rate: number) => {
    if (rate <= 2) return "Healthy";
    if (rate <= 5) return "Moderate";
    return "High Risk";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-primary" />
          Animal Exits & Mortality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Exits</p>
            <p className="text-xl font-bold">{totalExits}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Mortality Rate</p>
            <p className={`text-xl font-bold ${getMortalityColor(mortalityRate)}`}>
              {mortalityRate.toFixed(2)}%
            </p>
            <p className={`text-xs ${getMortalityColor(mortalityRate)}`}>
              {getMortalityStatus(mortalityRate)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Sales Revenue</p>
            <p className="text-lg font-bold text-primary">
              {formatCurrency(salesRevenue)}
            </p>
          </div>
        </div>

        {/* Exit Breakdown Chart */}
        {hasData ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={exitData}
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {exitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value} animals`, '']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            No exit data available
          </div>
        )}

        {/* Exit Breakdown List */}
        <div className="grid grid-cols-2 gap-2">
          {exitData.map((item) => {
            const Icon = item.icon;
            return (
              <div 
                key={item.name} 
                className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm"
              >
                <Icon className="h-4 w-4" style={{ color: item.color }} />
                <span className="flex-1">{item.name}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Wheat, PieChartIcon } from "lucide-react";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface FeedCostAnalyticsProps {
  farmId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'concentrates': 'hsl(var(--chart-1))',
  'roughage': 'hsl(var(--chart-2))',
  'minerals': 'hsl(var(--chart-3))',
  'supplements': 'hsl(var(--chart-4))',
  'unknown': 'hsl(var(--chart-5))',
};

export function FeedCostAnalytics({ farmId }: FeedCostAnalyticsProps) {
  const { height, xAxisProps, legendProps } = useResponsiveChart({ size: 'medium' });

  // Fetch feeding records with costs for the last 6 months
  const { data: feedingCosts, isLoading } = useQuery({
    queryKey: ['feed-cost-analytics', farmId],
    queryFn: async () => {
      const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('feeding_records')
        .select(`
          id,
          record_datetime,
          kilograms,
          cost_per_kg_at_time,
          feed_type,
          feed_inventory_id,
          animal:animals!inner(farm_id)
        `)
        .eq('animal.farm_id', farmId)
        .gte('record_datetime', sixMonthsAgo)
        .order('record_datetime');

      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId,
  });

  // Fetch inventory for category mapping
  const { data: inventory = [] } = useQuery({
    queryKey: ['feed-inventory-categories', farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, category')
        .eq('farm_id', farmId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId,
  });

  // Create category mapping
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    inventory.forEach(item => {
      map[item.id] = item.category || 'unknown';
    });
    return map;
  }, [inventory]);

  // Aggregate by month
  const monthlyData = useMemo(() => {
    if (!feedingCosts) return [];

    const byMonth: Record<string, { total: number; kg: number; count: number }> = {};
    
    feedingCosts.forEach(record => {
      const month = format(new Date(record.record_datetime), 'MMM yyyy');
      if (!byMonth[month]) {
        byMonth[month] = { total: 0, kg: 0, count: 0 };
      }
      
      const cost = record.cost_per_kg_at_time 
        ? record.kilograms * record.cost_per_kg_at_time 
        : 0;
      
      byMonth[month].total += cost;
      byMonth[month].kg += record.kilograms;
      byMonth[month].count += 1;
    });

    return Object.entries(byMonth).map(([month, data]) => ({
      month,
      totalCost: Math.round(data.total),
      totalKg: Math.round(data.kg),
      avgCostPerKg: data.kg > 0 ? Math.round((data.total / data.kg) * 100) / 100 : 0,
      recordCount: data.count,
    }));
  }, [feedingCosts]);

  // Aggregate by category
  const categoryData = useMemo(() => {
    if (!feedingCosts) return [];

    const byCategory: Record<string, number> = {};
    
    feedingCosts.forEach(record => {
      const category = record.feed_inventory_id 
        ? categoryMap[record.feed_inventory_id] || 'unknown'
        : record.feed_type === 'Fresh Cut and Carry' ? 'roughage' : 'unknown';
      
      const cost = record.cost_per_kg_at_time 
        ? record.kilograms * record.cost_per_kg_at_time 
        : 0;
      
      byCategory[category] = (byCategory[category] || 0) + cost;
    });

    return Object.entries(byCategory)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Math.round(value),
        color: CATEGORY_COLORS[name] || CATEGORY_COLORS.unknown,
      }));
  }, [feedingCosts, categoryMap]);

  // Summary stats
  const summary = useMemo(() => {
    if (!feedingCosts || feedingCosts.length === 0) {
      return { totalCost: 0, avgCostPerKg: 0, totalKg: 0, mostExpensive: '-' };
    }

    let totalCost = 0;
    let totalKg = 0;
    const costByFeedType: Record<string, number> = {};

    feedingCosts.forEach(record => {
      const cost = record.cost_per_kg_at_time 
        ? record.kilograms * record.cost_per_kg_at_time 
        : 0;
      totalCost += cost;
      totalKg += record.kilograms;
      costByFeedType[record.feed_type] = (costByFeedType[record.feed_type] || 0) + cost;
    });

    const mostExpensive = Object.entries(costByFeedType)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return {
      totalCost: Math.round(totalCost),
      avgCostPerKg: totalKg > 0 ? Math.round((totalCost / totalKg) * 100) / 100 : 0,
      totalKg: Math.round(totalKg),
      mostExpensive,
    };
  }, [feedingCosts]);

  // Trend calculation
  const trend = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const lastTwo = monthlyData.slice(-2);
    const diff = lastTwo[1].totalCost - lastTwo[0].totalCost;
    const pct = lastTwo[0].totalCost > 0 
      ? Math.round((diff / lastTwo[0].totalCost) * 100) 
      : 0;
    return { diff, pct, direction: diff >= 0 ? 'up' : 'down' as const };
  }, [monthlyData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasData = feedingCosts && feedingCosts.length > 0;
  const hasCostData = feedingCosts?.some(r => r.cost_per_kg_at_time !== null);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Feed Cost Analytics
          </CardTitle>
          <CardDescription>
            No feeding records found for the last 6 months.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Total Cost (6mo)
            </div>
            <p className="text-2xl font-bold mt-1">
              KES {summary.totalCost.toLocaleString()}
            </p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${trend.direction === 'up' ? 'text-destructive' : 'text-green-600'}`}>
                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.pct}% vs last month
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wheat className="h-4 w-4" />
              Avg Cost/kg
            </div>
            <p className="text-2xl font-bold mt-1">
              KES {summary.avgCostPerKg.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Total Feed Used</div>
            <p className="text-2xl font-bold mt-1">
              {summary.totalKg.toLocaleString()} kg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Most Expensive</div>
            <p className="text-lg font-semibold mt-1 truncate" title={summary.mostExpensive}>
              {summary.mostExpensive}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasCostData && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> Limited cost data available. Add cost information when recording feeds for accurate analytics.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly Cost Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Feed Cost Trend</CardTitle>
          <CardDescription>Total feed costs over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" {...xAxisProps} />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  fontSize={12}
                />
                <Tooltip 
                  formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Cost']}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar 
                  dataKey="totalCost" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cost by Category */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cost by Feed Category</CardTitle>
            <CardDescription>Breakdown of feed costs by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: height }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Cost']}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend {...legendProps} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost per KG Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Average Cost per KG</CardTitle>
          <CardDescription>Monthly average cost per kilogram of feed</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" {...xAxisProps} />
                <YAxis 
                  tickFormatter={(value) => `${value}`}
                  fontSize={12}
                />
                <Tooltip 
                  formatter={(value: number) => [`KES ${value.toFixed(2)}`, 'Cost/kg']}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgCostPerKg" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

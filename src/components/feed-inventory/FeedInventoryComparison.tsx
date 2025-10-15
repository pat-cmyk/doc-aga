import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import type { FeedInventoryItem, ComparisonResult } from "@/lib/feedInventory";
import type { MonthlyFeedForecast } from "@/lib/feedForecast";
import { compareInventoryToForecast, getStatusColor } from "@/lib/feedInventory";
import { useToast } from "@/hooks/use-toast";

interface FeedInventoryComparisonProps {
  farmId: string;
  forecasts: MonthlyFeedForecast[];
}

export function FeedInventoryComparison({ farmId, forecasts }: FeedInventoryComparisonProps) {
  const [inventory, setInventory] = useState<FeedInventoryItem[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchInventory();
  }, [farmId]);

  useEffect(() => {
    if (inventory.length > 0 && forecasts.length > 0) {
      const results = compareInventoryToForecast(inventory, forecasts);
      setComparison(results);
    }
  }, [inventory, forecasts]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId);

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory comparison",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading comparison...</div>;
  }

  if (inventory.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Inventory Data</h3>
          <p className="text-muted-foreground">
            Add feed stock to see comparison with forecast requirements.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = forecasts.map((forecast, index) => {
    const totalStock = inventory.reduce((sum, item) => sum + item.quantity_kg, 0);
    const cumulativeConsumption = forecasts
      .slice(0, index + 1)
      .reduce((sum, f) => sum + f.totalFeedKgPerMonth, 0);
    const remainingStock = Math.max(0, totalStock - cumulativeConsumption);

    return {
      month: forecast.month,
      currentStock: totalStock,
      remainingStock,
      required: forecast.totalFeedKgPerMonth,
      cumulative: cumulativeConsumption,
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {comparison.map((item) => (
          <Card key={item.feedType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{item.feedType}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Coverage</span>
                  <Badge className={getStatusColor(item.status)}>
                    {item.daysOfCoverage} days
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {item.surplusDeficit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(item.surplusDeficit).toLocaleString()} kg
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock vs. Forecast Requirements</CardTitle>
          <CardDescription>
            Detailed comparison of current inventory against projected needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feed Type</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Next Month</TableHead>
                <TableHead className="text-right">6-Month Total</TableHead>
                <TableHead className="text-right">Surplus/Deficit</TableHead>
                <TableHead className="text-right">Days Coverage</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.map((item) => (
                <TableRow key={item.feedType}>
                  <TableCell className="font-medium">{item.feedType}</TableCell>
                  <TableCell className="text-right">
                    {item.currentStock.toLocaleString()} kg
                  </TableCell>
                  <TableCell className="text-right">
                    {item.nextMonthRequirement.toLocaleString()} kg
                  </TableCell>
                  <TableCell className="text-right">
                    {item.sixMonthRequirement.toLocaleString()} kg
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={item.surplusDeficit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {item.surplusDeficit >= 0 ? '+' : ''}
                      {item.surplusDeficit.toLocaleString()} kg
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.daysOfCoverage} days
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Depletion Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Depletion Forecast</CardTitle>
          <CardDescription>
            Projected inventory levels vs. consumption over 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="remainingStock"
                stackId="1"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                name="Remaining Stock"
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stackId="2"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.3}
                name="Cumulative Consumption"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

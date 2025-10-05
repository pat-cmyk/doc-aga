import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sprout, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MonthlyFeedForecast, calculateTotalFeedNeeded } from "@/lib/feedForecast";

interface FeedForecastProps {
  forecasts: MonthlyFeedForecast[];
}

export function FeedForecast({ forecasts }: FeedForecastProps) {
  const totals = calculateTotalFeedNeeded(forecasts);

  // Prepare chart data
  const chartData = forecasts.map(f => ({
    month: f.month,
    feed: f.totalFeedKgPerDay,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Month Total</CardTitle>
            <Sprout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {forecasts[0]?.totalFeedKgPerMonth.toLocaleString()} kg
            </div>
            <p className="text-xs text-muted-foreground">
              ~{forecasts[0]?.totalFeedKgPerDay} kg/day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">6-Month Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.avgPerMonth.toLocaleString()} kg
            </div>
            <p className="text-xs text-muted-foreground">
              per month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">6-Month Total</CardTitle>
            <Sprout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.totalKg.toLocaleString()} kg
            </div>
            <p className="text-xs text-muted-foreground">
              total feed needed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Feed Requirements Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis label={{ value: 'kg/day', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="feed" fill="hsl(var(--primary))" name="Feed (kg/day)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Forecast Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Feed Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Daily (kg)</TableHead>
                <TableHead className="text-right">Monthly (kg)</TableHead>
                <TableHead>Stage Breakdown</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.map((forecast, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{forecast.month}</TableCell>
                  <TableCell className="text-right">{forecast.totalFeedKgPerDay}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {forecast.totalFeedKgPerMonth.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {Object.entries(forecast.breakdownByStage).map(([stage, data]) => (
                        <div key={stage} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{stage} ({data.count}):</span>
                          <span className="font-medium">{Math.round(data.feedKgPerDay)} kg/day</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-2 text-sm">
            <Sprout className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-4">
              <div>
                <p className="font-medium">Feed Forecast Methodology</p>
                <p className="text-muted-foreground mt-1">
                  Calculations based on standard dairy cattle feed requirements (2-3.5% of body weight per day).
                  Lactating cows require more feed than dry cows. Growing animals have higher requirements for growth.
                  Forecasts assume normal growth rates and may vary based on breed, health, and environmental factors.
                </p>
              </div>
              
              <div className="border-t border-primary/10 pt-4">
                <p className="font-medium mb-2">Formula by Category:</p>
                <ul className="text-muted-foreground space-y-1 ml-4">
                  <li>• <span className="font-medium text-foreground">Lactating cows:</span> Weight × 3.5%</li>
                  <li>• <span className="font-medium text-foreground">Calves:</span> Weight × 3.0%</li>
                  <li>• <span className="font-medium text-foreground">Growing heifers/bulls:</span> Weight × 2.5%</li>
                  <li>• <span className="font-medium text-foreground">Mature bulls:</span> Weight × 2.5%</li>
                  <li>• <span className="font-medium text-foreground">Dry/pregnant cows:</span> Weight × 2.0%</li>
                </ul>
              </div>

              <div className="border-t border-primary/10 pt-4">
                <p className="font-medium mb-2">Sample Computation:</p>
                <div className="text-muted-foreground space-y-1 bg-background/50 p-3 rounded-md">
                  <p><span className="font-medium text-foreground">Lactating cow</span> weighing 450 kg:</p>
                  <p className="ml-4">Daily feed = 450 kg × 3.5% = <span className="font-semibold text-foreground">15.75 kg/day</span></p>
                  <p className="ml-4">Monthly feed = 15.75 kg × 30 days = <span className="font-semibold text-foreground">472.5 kg/month</span></p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

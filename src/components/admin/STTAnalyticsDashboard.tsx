import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSTTAnalytics, useCorrectionStats } from "@/hooks/useSTTAnalytics";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Mic, Clock, CheckCircle, XCircle, AlertTriangle, Users, Download, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function STTAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  
  const startDate = dateRange === "7d" 
    ? subDays(new Date(), 7) 
    : dateRange === "30d" 
    ? subDays(new Date(), 30) 
    : subDays(new Date(), 90);

  const { data: analytics, isLoading, error } = useSTTAnalytics(startDate);
  const { data: correctionStats } = useCorrectionStats();

  const handleExportCSV = () => {
    if (!analytics?.daily_breakdown) return;

    const csv = [
      ["Date", "Total", "Success", "Success Rate (%)", "Avg Latency (ms)"],
      ...analytics.daily_breakdown.map((day) => [
        day.day,
        day.total,
        day.success_count,
        day.success_rate,
        day.avg_latency_ms,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stt-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load STT analytics. Please try again later.
        </CardContent>
      </Card>
    );
  }

  const summary = analytics?.summary || {
    total_transcriptions: 0,
    success_count: 0,
    error_count: 0,
    rate_limited_count: 0,
    success_rate: 0,
    avg_latency_ms: 0,
    p95_latency_ms: 0,
    avg_audio_size_bytes: 0,
    avg_transcription_length: 0,
  };

  const correctionRate = summary.total_transcriptions > 0
    ? ((correctionStats?.totalCorrections || 0) / summary.total_transcriptions * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={dateRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={dateRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("30d")}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange("90d")}
          >
            90 Days
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              Transcriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_transcriptions}</div>
            <p className="text-xs text-muted-foreground">Total requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.success_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.success_count} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avg_latency_ms || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              P95: {summary.p95_latency_ms || 0}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Correction Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{correctionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {correctionStats?.totalCorrections || 0} corrections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Unique Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.unique_users || 0}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Transcription Volume</CardTitle>
            <CardDescription>Requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.daily_breakdown && analytics.daily_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.daily_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Total"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="success_count" 
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={2}
                    name="Success"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latency Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latency Trend</CardTitle>
            <CardDescription>Average response time (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.daily_breakdown && analytics.daily_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.daily_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")}
                    formatter={(value) => [`${value}ms`, "Avg Latency"]}
                  />
                  <Bar 
                    dataKey="avg_latency_ms" 
                    fill="hsl(var(--primary))" 
                    name="Avg Latency"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown & Errors */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model Performance</CardTitle>
            <CardDescription>Breakdown by STT provider</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.model_breakdown && analytics.model_breakdown.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Success %</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.model_breakdown.map((model, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {model.model_provider}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {model.model_version}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{model.total}</TableCell>
                      <TableCell className="text-right">
                        <span className={model.success_rate >= 95 ? "text-green-600" : model.success_rate >= 80 ? "text-amber-600" : "text-red-600"}>
                          {model.success_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{model.avg_latency_ms}ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No model data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Error Breakdown
            </CardTitle>
            <CardDescription>Most common errors</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.error_breakdown && analytics.error_breakdown.length > 0 ? (
              <div className="space-y-3">
                {analytics.error_breakdown.map((err, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {err.error_message}
                    </span>
                    <Badge variant="destructive" className="ml-2">
                      {err.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No errors recorded
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Corrections */}
      {correctionStats?.recentCorrections && correctionStats.recentCorrections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent User Corrections</CardTitle>
            <CardDescription>
              Transcriptions that users manually corrected (quality indicator)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Original</TableHead>
                  <TableHead>Corrected</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {correctionStats.recentCorrections.slice(0, 10).map((correction: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="text-muted-foreground line-through">
                      {correction.original_text.substring(0, 60)}...
                    </TableCell>
                    <TableCell>
                      {correction.corrected_text.substring(0, 60)}...
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(correction.created_at), "MMM d")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

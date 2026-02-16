import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataEntryAnalytics } from "@/hooks/useDataEntryAnalytics";
import { useLocationFilters } from "@/hooks/useLocationFilters";
import { DataCategory } from "@/types/government";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Mic, Keyboard, TrendingUp, TrendingDown, Download, Hash } from "lucide-react";
import { format, subDays } from "date-fns";

interface DataEntryAnalyticsProps {
  dataCategory: DataCategory;
}

export function DataEntryAnalytics({ dataCategory }: DataEntryAnalyticsProps) {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");
  const [region, setRegion] = useState<string | undefined>();
  const [province, setProvince] = useState<string | undefined>();
  const [municipality, setMunicipality] = useState<string | undefined>();

  const { getRegions, getProvinces, getMunicipalities } = useLocationFilters();

  const endDate = new Date();
  const startDate = dateRange === "7d"
    ? subDays(endDate, 7)
    : dateRange === "30d"
    ? subDays(endDate, 30)
    : subDays(endDate, 90);

  const { data: analytics, isLoading, error } = useDataEntryAnalytics({
    startDate,
    endDate,
    dataCategory,
    region: region && region !== "all" ? region : undefined,
    province: province && province !== "all" ? province : undefined,
    municipality: municipality && municipality !== "all" ? municipality : undefined,
  });

  const handleRegionChange = (value: string) => {
    setRegion(value);
    setProvince(undefined);
    setMunicipality(undefined);
  };

  const handleProvinceChange = (value: string) => {
    setProvince(value);
    setMunicipality(undefined);
  };

  const handleExportCSV = () => {
    if (!analytics?.by_location) return;
    const csv = [
      ["Region", "Province", "Total", "Voice", "Typed", "Voice %"],
      ...analytics.by_location.map((l) => [
        l.region, l.province, l.total, l.voice_count, l.typed_count, l.voice_pct
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entry-methods-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load entry method analytics.</CardContent></Card>
    );
  }

  const summary = analytics?.summary || { total: 0, voice_count: 0, typed_count: 0, voice_pct: 0, prev_voice_pct: 0 };
  const trendUp = summary.voice_pct > summary.prev_voice_pct;
  const trendDiff = Math.abs(summary.voice_pct - summary.prev_voice_pct);

  const activityLabels: Record<string, string> = {
    milking: "Milking",
    feeding: "Feeding",
    weight: "Weight",
    health: "Health",
    injection: "Injection",
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((range) => (
            <Button key={range} variant={dateRange === range ? "default" : "outline"} size="sm" onClick={() => setDateRange(range)}>
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
            </Button>
          ))}
        </div>

        <Select value={region || "all"} onValueChange={handleRegionChange}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {getRegions().map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {region && region !== "all" && (
          <Select value={province || "all"} onValueChange={handleProvinceChange}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Province" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Provinces</SelectItem>
              {getProvinces(region).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {province && province !== "all" && (
          <Select value={municipality || "all"} onValueChange={setMunicipality}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Municipality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Municipalities</SelectItem>
              {getMunicipalities(region, province).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={handleExportCSV} className="ml-auto">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />Voice Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.voice_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{summary.voice_pct}% of total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-muted-foreground" />Typed Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.typed_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{summary.total > 0 ? (100 - summary.voice_pct).toFixed(1) : 0}% of total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {trendUp ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              Voice Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {trendUp ? "+" : "-"}{trendDiff.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs previous period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Voice vs Typed</CardTitle>
            <CardDescription>Entry volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.daily && analytics.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(v) => format(new Date(v), "MMM d")} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                  <Line type="monotone" dataKey="voice_count" stroke="hsl(var(--primary))" strokeWidth={2} name="Voice" />
                  <Line type="monotone" dataKey="typed_count" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Typed" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* By Activity Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice Adoption by Type</CardTitle>
            <CardDescription>Voice usage % per activity</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.by_type && analytics.by_type.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.by_type.map(t => ({ ...t, label: activityLabels[t.activity_type] || t.activity_type }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} unit="%" />
                  <Tooltip formatter={(value: number) => [`${value}%`, "Voice %"]} />
                  <Bar dataKey="voice_pct" fill="hsl(var(--primary))" name="Voice %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entry Methods by Location</CardTitle>
          <CardDescription>Regional breakdown of voice vs typed entries</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.by_location && analytics.by_location.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Province</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Voice</TableHead>
                  <TableHead className="text-right">Typed</TableHead>
                  <TableHead className="text-right">Voice %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.by_location.map((loc, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{loc.region}</TableCell>
                    <TableCell>{loc.province}</TableCell>
                    <TableCell className="text-right">{loc.total}</TableCell>
                    <TableCell className="text-right">{loc.voice_count}</TableCell>
                    <TableCell className="text-right">{loc.typed_count}</TableCell>
                    <TableCell className="text-right font-medium">{loc.voice_pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No location data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

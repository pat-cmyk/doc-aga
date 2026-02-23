import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, TrendingUp, AlertTriangle, Hash, Edit, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { DataCategory } from "@/types/government";
import { toast } from "@/hooks/use-toast";

interface FaqUsageAnalyticsTabProps {
  dataCategory?: DataCategory;
  onEditFaq?: (faq: any) => void;
}

interface FaqUsageStat {
  id: string;
  question: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  total_matches: number;
  matches_last_30d: number;
  matches_last_7d: number;
  last_matched_at: string | null;
}

interface MatchTimelinePoint {
  match_date: string;
  match_count: number;
}

export const FaqUsageAnalyticsTab = ({ dataCategory = 'all', onEditFaq }: FaqUsageAnalyticsTabProps) => {
  const queryClient = useQueryClient();
  const { fontSize, xAxisProps, height } = useResponsiveChart({ size: 'medium' });

  const { data: usageStats, isLoading: statsLoading } = useQuery({
    queryKey: ["faq-usage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_faq_usage_stats");
      if (error) throw error;
      return (data as unknown as FaqUsageStat[]) || [];
    },
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["faq-match-timeline"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_faq_match_timeline", { p_days: 30 });
      if (error) throw error;
      return (data as unknown as MatchTimelinePoint[]) || [];
    },
  });

  const { data: totalQueryCount } = useQuery({
    queryKey: ["faq-total-query-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Derived metrics
  const metrics = useMemo(() => {
    if (!usageStats) return null;
    const totalMatches = usageStats.reduce((sum, f) => sum + f.total_matches, 0);
    const matchRate = totalQueryCount && totalQueryCount > 0
      ? ((totalMatches / totalQueryCount) * 100).toFixed(1)
      : "0";
    const mostUsed = usageStats[0]; // already sorted by total_matches DESC
    const unusedActive = usageStats.filter(f => f.is_active && f.matches_last_30d === 0);
    return { totalMatches, matchRate, mostUsed, unusedActive };
  }, [usageStats, totalQueryCount]);

  // Top 10 FAQs for bar chart (last 30 days)
  const topFaqsChart = useMemo(() => {
    if (!usageStats) return [];
    return usageStats
      .filter(f => f.matches_last_30d > 0)
      .slice(0, 10)
      .map(f => ({
        name: f.question.length > 40 ? f.question.slice(0, 37) + "..." : f.question,
        matches: f.matches_last_30d,
      }));
  }, [usageStats]);

  // Timeline formatted for chart
  const timelineChart = useMemo(() => {
    if (!timeline) return [];
    return timeline.map(t => ({
      date: format(new Date(t.match_date), "MMM dd"),
      matches: t.match_count,
    }));
  }, [timeline]);

  const handleDeactivate = async (faqId: string) => {
    const { error } = await supabase
      .from("doc_aga_faqs")
      .update({ is_active: false })
      .eq("id", faqId);
    if (error) {
      toast({ title: "Error", description: "Failed to deactivate FAQ", variant: "destructive" });
      return;
    }
    toast({ title: "FAQ deactivated" });
    queryClient.invalidateQueries({ queryKey: ["faq-usage-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-faqs-with-matches"] });
  };

  if (statsLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading FAQ usage analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Total FAQ Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalMatches || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Match Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.matchRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Queries matched to FAQ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Most Used FAQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">
              {metrics?.mostUsed?.question || "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.mostUsed ? `${metrics.mostUsed.total_matches} matches` : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Unused FAQs (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.unusedActive?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active with 0 matches</p>
          </CardContent>
        </Card>
      </div>

      {/* Top FAQs Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top FAQs (Last 30 Days)</CardTitle>
          <CardDescription>Most frequently matched FAQs by match count</CardDescription>
        </CardHeader>
        <CardContent>
          {topFaqsChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={topFaqsChart} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: fontSize - 1 }}
                  width={110}
                />
                <Tooltip />
                <Bar dataKey="matches" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No FAQ matches in the last 30 days</div>
          )}
        </CardContent>
      </Card>

      {/* FAQ Match Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>FAQ Match Timeline (Last 30 Days)</CardTitle>
          <CardDescription>Daily volume of queries matched to FAQs</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={timelineChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize }} angle={xAxisProps.angle} textAnchor={xAxisProps.textAnchor} />
                <YAxis tick={{ fontSize }} />
                <Tooltip />
                <Line type="monotone" dataKey="matches" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No timeline data available</div>
          )}
        </CardContent>
      </Card>

      {/* Unused FAQs Table */}
      {metrics?.unusedActive && metrics.unusedActive.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unused Active FAQs (Last 30 Days)
            </CardTitle>
            <CardDescription>
              These active FAQs had zero matches recently — consider editing or deactivating them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>All-Time Matches</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.unusedActive.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="max-w-[300px] truncate">{faq.question}</TableCell>
                    <TableCell>
                      {faq.category ? (
                        <Badge variant="outline">{faq.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{faq.total_matches}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {onEditFaq && (
                          <Button size="sm" variant="outline" onClick={() => onEditFaq(faq)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivate(faq.id)}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
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
};

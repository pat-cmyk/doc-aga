import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";

interface FeedbackStats {
  positive: number;
  negative: number;
  total: number;
  positiveRate: number;
}

export const FeedbackAnalyticsTab = () => {
  const { fontSize } = useResponsiveChart({ size: 'medium' });

  // Fetch feedback statistics
  const { data: feedbackStats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-feedback-stats"],
    queryFn: async (): Promise<FeedbackStats> => {
      const { count: positiveCount } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true })
        .eq("feedback_rating", "positive");

      const { count: negativeCount } = await supabase
        .from("doc_aga_queries")
        .select("*", { count: "exact", head: true })
        .eq("feedback_rating", "negative");

      const positive = positiveCount || 0;
      const negative = negativeCount || 0;
      const total = positive + negative;
      const positiveRate = total > 0 ? (positive / total) * 100 : 0;

      return { positive, negative, total, positiveRate };
    },
  });

  // Fetch queries with negative feedback for review
  const { data: negativeFeedback } = useQuery({
    queryKey: ["admin-negative-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_aga_queries")
        .select("id, question, answer, feedback_at, feedback_comment")
        .eq("feedback_rating", "negative")
        .order("feedback_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const pieData = feedbackStats ? [
    { name: "Helpful", value: feedbackStats.positive, color: "hsl(var(--primary))" },
    { name: "Not Helpful", value: feedbackStats.negative, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-4">
      {/* Feedback Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feedbackStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Responses rated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-primary" />
              Positive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{feedbackStats?.positive || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Helpful responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-destructive" />
              Negative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{feedbackStats?.negative || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs improvement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {(feedbackStats?.positiveRate || 0) >= 70 ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              Satisfaction Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feedbackStats?.positiveRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Positive feedback ratio</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback Distribution</CardTitle>
            <CardDescription>Breakdown of farmer ratings</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No feedback data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Negative Feedback Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-destructive" />
              Recent Negative Feedback
            </CardTitle>
            <CardDescription>Questions that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {negativeFeedback?.slice(0, 5).map((query) => (
                <div key={query.id} className="p-2 border rounded-lg">
                  <p className="text-sm font-medium line-clamp-2">{query.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {query.feedback_at && format(new Date(query.feedback_at), "MMM dd, h:mm a")}
                  </p>
                </div>
              ))}
              {(!negativeFeedback || negativeFeedback.length === 0) && (
                <p className="text-center py-4 text-muted-foreground">
                  No negative feedback yet 🎉
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Negative Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Questions with Negative Feedback</CardTitle>
          <CardDescription>
            Review these to improve Doc Aga's knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>AI Response</TableHead>
                <TableHead>Feedback Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {negativeFeedback?.map((query) => (
                <TableRow key={query.id}>
                  <TableCell className="max-w-xs">
                    <p className="font-medium line-clamp-2">{query.question}</p>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {query.answer || "No response recorded"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {query.feedback_at && format(new Date(query.feedback_at), "MMM dd, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {(!negativeFeedback || negativeFeedback.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No negative feedback to review
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

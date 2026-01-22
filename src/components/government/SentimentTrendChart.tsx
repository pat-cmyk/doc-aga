import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CHART_FONT_SIZE, CHART_LEGEND, CHART_XAXIS, CHART_MARGIN } from "@/lib/chartConfig";

export const SentimentTrendChart = () => {
  const { feedbackList, isLoading } = useGovernmentFeedback({});
  const isMobile = useIsMobile();
  const fontSize = isMobile ? CHART_FONT_SIZE.mobile : CHART_FONT_SIZE.desktop;
  const xAxisConfig = isMobile ? CHART_XAXIS.mobile : CHART_XAXIS.desktop;
  const legendConfig = isMobile ? CHART_LEGEND.mobile : CHART_LEGEND.desktop;
  const margin = isMobile ? CHART_MARGIN.mobile : CHART_MARGIN.desktop;

  if (isLoading) {
    return <div className="text-center py-8">Loading sentiment trends...</div>;
  }

  // Group by date and sentiment
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 13 - i));
    return format(date, "yyyy-MM-dd");
  });

  const trendData = last14Days.map(date => {
    const dayFeedback = feedbackList?.filter(
      (f: any) => format(new Date(f.created_at), "yyyy-MM-dd") === date
    ) || [];

    return {
      date: format(new Date(date), "MMM dd"),
      urgent: dayFeedback.filter((f: any) => f.sentiment === "urgent").length,
      negative: dayFeedback.filter((f: any) => f.sentiment === "negative").length,
      neutral: dayFeedback.filter((f: any) => f.sentiment === "neutral").length,
      positive: dayFeedback.filter((f: any) => f.sentiment === "positive").length,
      total: dayFeedback.length,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Sentiment Trend (Last 14 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
          <BarChart data={trendData} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date"
              tick={{ fontSize }}
              angle={xAxisConfig.angle}
              textAnchor={xAxisConfig.textAnchor}
              height={xAxisConfig.height}
              tickMargin={xAxisConfig.tickMargin}
              interval={xAxisConfig.interval}
            />
            <YAxis tick={{ fontSize }} />
            <Tooltip />
            <Legend 
              wrapperStyle={{ fontSize: legendConfig.fontSize, paddingTop: legendConfig.paddingTop }}
              iconSize={legendConfig.iconSize}
            />
            <Bar dataKey="urgent" fill="#ef4444" name="Urgent" stackId="a" />
            <Bar dataKey="negative" fill="#f97316" name="Negative" stackId="a" />
            <Bar dataKey="neutral" fill="#64748b" name="Neutral" stackId="a" />
            <Bar dataKey="positive" fill="#10b981" name="Positive" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

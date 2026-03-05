import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { DataCategory } from "@/types/government";

interface SentimentTrendChartProps {
  dateFrom?: string;
  dateTo?: string;
  region?: string;
  dataCategory?: DataCategory;
}

export const SentimentTrendChart = ({ dateFrom, dateTo, region, dataCategory }: SentimentTrendChartProps) => {
  const { feedbackList, isLoading } = useGovernmentFeedback({ dateFrom, dateTo, region, dataCategory });

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

  const { isMobile, fontSize, xAxisProps, legendProps, margin } = useResponsiveChart({
    size: 'medium',
    dataLength: trendData.length,
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading sentiment trends...</div>;
  }

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
          <AreaChart data={trendData} margin={margin}>
            <defs>
              <linearGradient id="sentimentUrgent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="sentimentNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="sentimentNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="sentimentPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" strokeOpacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize }} {...xAxisProps} />
            <YAxis tick={{ fontSize }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="font-semibold mb-2">{payload[0]?.payload?.date}</p>
                      <p className="text-sm font-medium mb-1">Total: {total}</p>
                      {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: {entry.value}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={legendProps.wrapperStyle}
              iconSize={legendProps.iconSize}
            />
            <Area type="monotone" dataKey="urgent" fill="url(#sentimentUrgent)" stroke="#ef4444" strokeWidth={2} name="Urgent" stackId="a" />
            <Area type="monotone" dataKey="negative" fill="url(#sentimentNegative)" stroke="#f97316" strokeWidth={2} name="Negative" stackId="a" />
            <Area type="monotone" dataKey="neutral" fill="url(#sentimentNeutral)" stroke="#64748b" strokeWidth={2} name="Neutral" stackId="a" />
            <Area type="monotone" dataKey="positive" fill="url(#sentimentPositive)" stroke="#10b981" strokeWidth={2} name="Positive" stackId="a" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

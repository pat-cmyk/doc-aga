import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { categorizeQueries, QueryWithTopic, TOPIC_CATEGORIES } from "@/lib/queryTopicCategorizer";
import { TrendingUp } from "lucide-react";

interface TrendingTopicsCardProps {
  queries: QueryWithTopic[] | undefined;
}

const TOPIC_COLORS: Record<string, string> = {
  'mastitis': 'hsl(0, 70%, 50%)',
  'breeding': 'hsl(280, 70%, 50%)',
  'feeding': 'hsl(120, 60%, 45%)',
  'digestive': 'hsl(30, 80%, 50%)',
  'bloat': 'hsl(45, 80%, 50%)',
  'lameness': 'hsl(200, 70%, 50%)',
  'vaccination': 'hsl(160, 60%, 45%)',
  'milk': 'hsl(210, 70%, 55%)',
  'general': 'hsl(220, 15%, 50%)',
};

export const TrendingTopicsCard = ({ queries }: TrendingTopicsCardProps) => {
  const chartData = useMemo(() => {
    if (!queries || queries.length === 0) return [];
    
    const stats = categorizeQueries(queries);
    return stats.map(stat => ({
      name: stat.topic.length > 20 ? stat.topic.substring(0, 18) + '...' : stat.topic,
      fullName: stat.topic,
      count: stat.count,
      key: stat.key,
      fill: TOPIC_COLORS[stat.key] || TOPIC_COLORS.general,
    }));
  }, [queries]);

  const chartConfig = useMemo(() => {
    return TOPIC_CATEGORIES.reduce((acc, cat) => {
      acc[cat.key] = {
        label: cat.label,
        color: TOPIC_COLORS[cat.key] || TOPIC_COLORS.general,
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>);
  }, []);

  if (!queries || queries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Topics
          </CardTitle>
          <CardDescription>Query distribution by topic category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No query data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Trending Topics
        </CardTitle>
        <CardDescription>
          Query distribution by topic category (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 11 }}
                width={95}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return value;
                    }}
                  />
                }
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

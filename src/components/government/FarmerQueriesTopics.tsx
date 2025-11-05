import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFarmerQueries } from "@/hooks/useGovernmentStats";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

interface FarmerQueriesTopicsProps {
  startDate: Date;
  endDate: Date;
}

export const FarmerQueriesTopics = ({ startDate, endDate }: FarmerQueriesTopicsProps) => {
  const { data: queries, isLoading } = useFarmerQueries(startDate, endDate);

  const topTopics = useMemo(() => {
    if (!queries) return [];

    // Simple keyword-based categorization
    const categories: Record<string, { count: number; examples: string[] }> = {};

    const categorizeQuery = (question: string) => {
      const lower = question.toLowerCase();
      
      if (lower.includes("mastitis") || lower.includes("udder") || lower.includes("milk infection")) {
        return "Mastitis & Udder Health";
      } else if (lower.includes("pregnan") || lower.includes("calving") || lower.includes("breeding")) {
        return "Pregnancy & Breeding";
      } else if (lower.includes("feed") || lower.includes("nutrition") || lower.includes("diet")) {
        return "Feeding & Nutrition";
      } else if (lower.includes("diarrhea") || lower.includes("scours") || lower.includes("digestive")) {
        return "Digestive Issues";
      } else if (lower.includes("bloat") || lower.includes("gas") || lower.includes("stomach")) {
        return "Bloat & Stomach Issues";
      } else if (lower.includes("lame") || lower.includes("hoof") || lower.includes("leg")) {
        return "Lameness & Hoof Care";
      } else if (lower.includes("vaccine") || lower.includes("injection") || lower.includes("medicine")) {
        return "Vaccination & Treatment";
      } else if (lower.includes("milk") && !lower.includes("mastitis")) {
        return "Milk Production";
      } else {
        return "General Health & Management";
      }
    };

    queries.forEach((query) => {
      const topic = categorizeQuery(query.question);
      if (!categories[topic]) {
        categories[topic] = { count: 0, examples: [] };
      }
      categories[topic].count += 1;
      if (categories[topic].examples.length < 3) {
        categories[topic].examples.push(query.question.substring(0, 100));
      }
    });

    return Object.entries(categories)
      .map(([topic, data]) => ({
        topic,
        count: data.count,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [queries]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Farmer Queries</CardTitle>
          <CardDescription>Most common topics from Doc Aga consultations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Farmer Queries</CardTitle>
        <CardDescription>
          Most common topics from Doc Aga consultations - use this to inform training programs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topTopics.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No queries found for the selected period
          </p>
        ) : (
          <div className="space-y-4">
            {topTopics.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{item.topic}</h4>
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.count} queries
                    </span>
                  </div>
                  <div className="space-y-1">
                    {item.examples.map((example, i) => (
                      <p key={i} className="text-sm text-muted-foreground truncate">
                        "{example}..."
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

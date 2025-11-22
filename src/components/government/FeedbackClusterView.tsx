import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { Layers, Users, MapPin } from "lucide-react";
import { useState } from "react";

export const FeedbackClusterView = () => {
  const { feedbackList, isLoading } = useGovernmentFeedback({});
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center py-8">Clustering feedback...</div>;
  }

  // Cluster by category + location
  const clusters = feedbackList?.reduce((acc: any, feedback: any) => {
    const location = feedback.farms?.municipality || "Unknown";
    const category = feedback.primary_category;
    const key = `${category}-${location}`;

    if (!acc[key]) {
      acc[key] = {
        key,
        category,
        location,
        region: feedback.farms?.region,
        items: [],
        criticalCount: 0,
        avgPriority: 0,
      };
    }

    acc[key].items.push(feedback);
    if (feedback.auto_priority === "critical") {
      acc[key].criticalCount++;
    }

    return acc;
  }, {});

  // Calculate averages and filter clusters with 2+ items
  const significantClusters = Object.values(clusters || {})
    .map((cluster: any) => ({
      ...cluster,
      count: cluster.items.length,
      avgPriority:
        cluster.items.reduce((sum: number, f: any) => sum + f.priority_score, 0) /
        cluster.items.length,
    }))
    .filter((c: any) => c.count >= 2)
    .sort((a: any, b: any) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      return b.count - a.count;
    });

  const categoryLabels: Record<string, string> = {
    policy_concern: "Policy Concerns",
    market_access: "Market Access",
    veterinary_support: "Veterinary Support",
    training_request: "Training Requests",
    infrastructure: "Infrastructure",
    financial_assistance: "Financial Assistance",
    emergency_support: "Emergency Support",
    disease_outbreak: "Disease Outbreaks",
    feed_shortage: "Feed Shortages",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Clustered Concerns (Similar Issues)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {significantClusters.length > 0 ? (
          (significantClusters as any[]).map((cluster: any) => (
            <Card
              key={cluster.key}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() =>
                setSelectedCluster(selectedCluster === cluster.key ? null : cluster.key)
              }
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">
                        {categoryLabels[cluster.category] || cluster.category}
                      </Badge>
                      {cluster.criticalCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {cluster.criticalCount} Critical
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {cluster.location}, {cluster.region}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-lg">
                    <Users className="h-4 w-4 mr-1" />
                    {cluster.count}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Avg Priority: {Math.round(cluster.avgPriority)}/100</span>
                  <span>•</span>
                  <span>{cluster.count} farmer(s) affected</span>
                </div>

                {selectedCluster === cluster.key && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-xs font-medium">Individual Reports:</p>
                    {cluster.items.slice(0, 5).map((item: any, idx: number) => (
                      <div key={item.id} className="text-xs p-2 bg-muted rounded">
                        <p className="font-medium">
                          {idx + 1}. {item.ai_summary || item.transcription.slice(0, 100)}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    {cluster.items.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        + {cluster.items.length - 5} more reports
                      </p>
                    )}
                    <Button size="sm" variant="outline" className="w-full mt-2">
                      Bulk Respond to {cluster.count} Farmers
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No significant clusters detected</p>
            <p className="text-xs">Clusters appear when 2+ farmers report similar issues</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { Sparkles, AlertTriangle, TrendingUp, MapPin, Activity } from "lucide-react";
import { format, subDays } from "date-fns";

export const SmartInsightsPanel = () => {
  const { feedbackList, isLoading } = useGovernmentFeedback({});

  if (isLoading) {
    return <div className="text-center py-8">Generating insights...</div>;
  }

  // Generate AI-powered insights
  const insights = [];
  
  // Check for disease outbreak patterns
  const diseaseOutbreaks = feedbackList?.filter(
    (f: any) => f.primary_category === "disease_outbreak" && 
    new Date(f.created_at) >= subDays(new Date(), 7)
  ) || [];

  if (diseaseOutbreaks.length >= 3) {
    const locations = [...new Set(diseaseOutbreaks.map((f: any) => 
      `${f.farms?.municipality}, ${f.farms?.province}`
    ))];
    const diseases = diseaseOutbreaks
      .flatMap((f: any) => f.detected_entities?.diseases || [])
      .filter((d: string, i: number, arr: string[]) => arr.indexOf(d) === i);

    insights.push({
      type: "critical",
      icon: AlertTriangle,
      title: "Disease Outbreak Alert",
      description: `${diseaseOutbreaks.length} disease reports in ${locations.length} location(s) this week`,
      details: diseases.length > 0 ? `Detected: ${diseases.join(", ")}` : undefined,
      action: `Deploy veterinary support to ${locations[0]}`,
    });
  }

  // Check for feed shortage spikes
  const feedShortage = feedbackList?.filter(
    (f: any) => f.primary_category === "feed_shortage" &&
    new Date(f.created_at) >= subDays(new Date(), 7)
  ) || [];

  if (feedShortage.length >= 5) {
    const regions = [...new Set(feedShortage.map((f: any) => f.farms?.region))];
    insights.push({
      type: "warning",
      icon: TrendingUp,
      title: "Feed Shortage Spike",
      description: `${feedShortage.length} feed shortage reports across ${regions.length} region(s)`,
      action: `Coordinate with feed suppliers for ${regions.join(", ")}`,
    });
  }

  // Check for training request clusters
  const trainingRequests = feedbackList?.filter(
    (f: any) => f.primary_category === "training_request" &&
    new Date(f.created_at) >= subDays(new Date(), 30)
  ) || [];

  if (trainingRequests.length >= 8) {
    const topTopics = trainingRequests
      .flatMap((f: any) => f.tags || [])
      .reduce((acc: any, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
    const topTopic = Object.entries(topTopics).sort((a: any, b: any) => b[1] - a[1])[0];

    insights.push({
      type: "info",
      icon: Activity,
      title: "Training Demand Pattern",
      description: `${trainingRequests.length} training requests this month`,
      details: topTopic ? `Most requested: ${topTopic[0]} (${topTopic[1]} requests)` : undefined,
      action: "Schedule regional training sessions",
    });
  }

  // Check for critical backlog
  const criticalPending = feedbackList?.filter(
    (f: any) => f.auto_priority === "critical" && f.status === "submitted"
  ) || [];

  if (criticalPending.length > 0) {
    insights.push({
      type: "critical",
      icon: AlertTriangle,
      title: "Critical Backlog",
      description: `${criticalPending.length} critical case(s) pending acknowledgment`,
      action: "Immediate review required",
    });
  }

  // Geographic concentration analysis
  const locationCount = feedbackList?.reduce((acc: any, f: any) => {
    const loc = `${f.farms?.municipality}, ${f.farms?.province}`;
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {}) || {};

  const hotspot = Object.entries(locationCount).sort((a: any, b: any) => b[1] - a[1])[0];
  if (hotspot && (hotspot[1] as number) > 5) {
    insights.push({
      type: "info",
      icon: MapPin,
      title: "Geographic Hotspot",
      description: `${hotspot[1]} submissions from ${hotspot[0]}`,
      action: "Consider on-site visit or regional intervention",
    });
  }

  const typeColors: any = {
    critical: "border-red-500 bg-red-50 dark:bg-red-950",
    warning: "border-orange-500 bg-orange-50 dark:bg-orange-950",
    info: "border-blue-500 bg-blue-50 dark:bg-blue-950",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Insights & Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.length > 0 ? (
          insights.map((insight, idx) => {
            const Icon = insight.icon;
            return (
              <Alert key={idx} className={typeColors[insight.type]}>
                <Icon className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{insight.title}</p>
                      <Badge
                        variant={insight.type === "critical" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {insight.type.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm">{insight.description}</p>
                    {insight.details && (
                      <p className="text-xs text-muted-foreground">{insight.details}</p>
                    )}
                    <p className="text-sm font-medium mt-2">
                      💡 Recommended Action: {insight.action}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No significant patterns detected at this time</p>
            <p className="text-xs">AI will alert you when trends emerge</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

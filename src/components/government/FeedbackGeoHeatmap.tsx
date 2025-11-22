import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGovernmentFeedback } from "@/hooks/useGovernmentFeedback";
import { MapPin, AlertTriangle } from "lucide-react";

export const FeedbackGeoHeatmap = () => {
  const { feedbackList, isLoading } = useGovernmentFeedback({});

  if (isLoading) {
    return <div className="text-center py-8">Loading geographic data...</div>;
  }

  // Aggregate by location and priority
  const locationData = feedbackList?.reduce((acc: any, feedback: any) => {
    const location = `${feedback.farms?.municipality}, ${feedback.farms?.province}`;
    if (!acc[location]) {
      acc[location] = {
        location,
        region: feedback.farms?.region,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0,
      };
    }
    acc[location][feedback.auto_priority]++;
    acc[location].total++;
    return acc;
  }, {});

  const sortedLocations = Object.values(locationData || {})
    .sort((a: any, b: any) => {
      // Sort by critical first, then high, then total
      if (b.critical !== a.critical) return b.critical - a.critical;
      if (b.high !== a.high) return b.high - a.high;
      return b.total - a.total;
    })
    .slice(0, 15); // Top 15 locations

  const getIntensityColor = (location: any) => {
    if (location.critical > 0) return "bg-red-500";
    if (location.high >= 3) return "bg-orange-500";
    if (location.high > 0) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getIntensityOpacity = (total: number, max: number) => {
    const percentage = (total / max) * 100;
    if (percentage >= 80) return "opacity-100";
    if (percentage >= 60) return "opacity-80";
    if (percentage >= 40) return "opacity-60";
    if (percentage >= 20) return "opacity-40";
    return "opacity-20";
  };

  const maxTotal = Math.max(...(sortedLocations as any[]).map((l: any) => l.total));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geographic Concern Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedLocations.length > 0 ? (
            (sortedLocations as any[]).map((loc: any) => (
              <div key={loc.location} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{loc.location}</p>
                    <p className="text-xs text-muted-foreground">{loc.region}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {loc.critical > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {loc.critical} Critical
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {loc.total} total
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 h-3">
                  {loc.critical > 0 && (
                    <div
                      className="bg-red-500 rounded-sm"
                      style={{ width: `${(loc.critical / loc.total) * 100}%` }}
                      title={`${loc.critical} critical`}
                    />
                  )}
                  {loc.high > 0 && (
                    <div
                      className="bg-orange-500 rounded-sm"
                      style={{ width: `${(loc.high / loc.total) * 100}%` }}
                      title={`${loc.high} high`}
                    />
                  )}
                  {loc.medium > 0 && (
                    <div
                      className="bg-yellow-500 rounded-sm"
                      style={{ width: `${(loc.medium / loc.total) * 100}%` }}
                      title={`${loc.medium} medium`}
                    />
                  )}
                  {loc.low > 0 && (
                    <div
                      className="bg-blue-500 rounded-sm"
                      style={{ width: `${(loc.low / loc.total) * 100}%` }}
                      title={`${loc.low} low`}
                    />
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No geographic data available</p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Priority Legend:</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive" className="text-xs">Critical</Badge>
            <Badge className="text-xs bg-orange-500">High</Badge>
            <Badge className="text-xs bg-yellow-500 text-black">Medium</Badge>
            <Badge variant="secondary" className="text-xs">Low</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

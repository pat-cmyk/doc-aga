import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeatmapData } from "@/hooks/useGovernmentStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle } from "lucide-react";
interface AnimalHealthHeatmapProps {
  data?: HeatmapData[];
  comparisonData?: HeatmapData[];
  isLoading: boolean;
  error?: Error | null;
  comparisonMode?: boolean;
}

export const AnimalHealthHeatmap = ({ data, comparisonData, isLoading, error, comparisonMode }: AnimalHealthHeatmapProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Animal Health Heatmap</CardTitle>
          <CardDescription>Health event density by municipality (last 7 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {comparisonMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Primary Section */}
              <div>
                <Skeleton className="h-6 w-20 mb-3" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border">
                      <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="space-y-1">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Comparison Section */}
              <div>
                <Skeleton className="h-6 w-24 mb-3" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border">
                      <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="space-y-1">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="space-y-1">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-12 rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Animal Health Heatmap</CardTitle>
          <CardDescription>Health event density by municipality (last 7 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load health data. Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Animal Health Heatmap</CardTitle>
          <CardDescription>Health event density by municipality (last 7 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No health data available for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }

  const getPrevalenceColor = (rate: number) => {
    if (rate >= 20) return "bg-red-500";
    if (rate >= 10) return "bg-orange-500";
    if (rate >= 5) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getSeverityLevel = (rate: number) => {
    if (rate >= 20) return { label: "Critical", variant: "destructive" as const };
    if (rate >= 10) return { label: "High", variant: "default" as const };
    if (rate >= 5) return { label: "Moderate", variant: "secondary" as const };
    return { label: "Low", variant: "outline" as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Animal Health Heatmap</CardTitle>
        <CardDescription>
          Health event density by municipality (last 7 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {comparisonMode && comparisonData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Badge className="mb-3">Primary</Badge>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                {data.map((item, index) => {
                  const severity = getSeverityLevel(item.prevalence_rate);
                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {item.prevalence_rate >= 15 && (
                        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                          <div>
                            <p className="font-medium truncate">{item.municipality}</p>
                            <p className="text-sm text-muted-foreground">{item.region}</p>
                          </div>
                          <Badge variant={severity.variant} className="w-fit">
                            {severity.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2">
                          <span>{item.health_event_count} events</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{item.total_animals} animals</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-medium">{item.prevalence_rate}% prevalence</span>
                        </div>
                      </div>
                      <div
                        className={`h-12 w-12 rounded ${getPrevalenceColor(
                          item.prevalence_rate
                        )} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                      >
                        {item.prevalence_rate.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
                </div>
              </ScrollArea>
            </div>
            
            <div>
              <Badge variant="secondary" className="mb-3">Comparison</Badge>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                {comparisonData.map((item, index) => {
                  const severity = getSeverityLevel(item.prevalence_rate);
                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      {item.prevalence_rate >= 15 && (
                        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                          <div>
                            <p className="font-medium truncate">{item.municipality}</p>
                            <p className="text-sm text-muted-foreground">{item.region}</p>
                          </div>
                          <Badge variant={severity.variant} className="w-fit">
                            {severity.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2">
                          <span>{item.health_event_count} events</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{item.total_animals} animals</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-medium">{item.prevalence_rate}% prevalence</span>
                        </div>
                      </div>
                      <div
                        className={`h-12 w-12 rounded ${getPrevalenceColor(
                          item.prevalence_rate
                        )} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                      >
                        {item.prevalence_rate.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
          {data.map((item, index) => {
            const severity = getSeverityLevel(item.prevalence_rate);
            return (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                {item.prevalence_rate >= 15 && (
                  <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                    <div>
                      <p className="font-medium truncate">{item.municipality}</p>
                      <p className="text-sm text-muted-foreground">{item.region}</p>
                    </div>
                    <Badge variant={severity.variant} className="w-fit">
                      {severity.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2">
                    <span>{item.health_event_count} events</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{item.total_animals} animals</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="font-medium">{item.prevalence_rate}% prevalence</span>
                  </div>
                  {item.symptom_types && item.symptom_types.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {item.symptom_types.slice(0, 5).map((symptom, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {symptom}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.prevalence_rate >= 10 && (
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  )}
                  <div
                    className={`h-12 w-12 rounded ${getPrevalenceColor(
                      item.prevalence_rate
                    )} flex items-center justify-center text-white font-bold text-sm`}
                  >
                    {item.prevalence_rate.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

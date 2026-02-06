import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRegionalDataQuality, RegionalDataQualityData } from "@/hooks/useRegionalDataQuality";
import { DataCategory } from "@/types/government";
import { MapPin, Scale, Activity, Stethoscope, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";
import { useState } from "react";

interface DataQualityDashboardCardProps {
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory: DataCategory;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const MetricCard = ({ icon, label, value, color }: MetricCardProps) => {
  const getStatusColor = (pct: number) => {
    if (pct >= 80) return "text-green-600";
    if (pct >= 50) return "text-yellow-600";
    return "text-destructive";
  };

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <div className={color}>{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={value} className="flex-1 h-2" />
        <span className={`text-sm font-semibold ${getStatusColor(value)}`}>
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

const RegionRow = ({ region }: { region: RegionalDataQualityData }) => {
  const getScoreStatus = (score: number) => {
    if (score >= 80) return { variant: "default" as const, icon: <CheckCircle className="h-3 w-3" /> };
    if (score >= 50) return { variant: "secondary" as const, icon: null };
    return { variant: "destructive" as const, icon: <AlertTriangle className="h-3 w-3" /> };
  };

  const status = getScoreStatus(region.overall_quality_score);

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium">{region.region}</p>
        <p className="text-xs text-muted-foreground">{region.province}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right text-xs text-muted-foreground">
          <span>{region.total_farms} farms</span>
          <span className="mx-1">•</span>
          <span>{region.total_animals} animals</span>
        </div>
        <Badge variant={status.variant} className="gap-1 min-w-[60px] justify-center">
          {status.icon}
          {region.overall_quality_score.toFixed(0)}%
        </Badge>
      </div>
    </div>
  );
};

export const DataQualityDashboardCard = ({
  region,
  province,
  municipality,
  dataCategory,
}: DataQualityDashboardCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, error } = useRegionalDataQuality(
    region,
    province,
    municipality,
    dataCategory
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Data Quality Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Data Quality Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load data quality metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  const getOverallStatus = (score: number) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-600", bg: "bg-green-50" };
    if (score >= 60) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50" };
    if (score >= 40) return { label: "Fair", color: "text-yellow-600", bg: "bg-yellow-50" };
    return { label: "Needs Improvement", color: "text-destructive", bg: "bg-destructive/10" };
  };

  const status = getOverallStatus(data.overallQualityScore);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Data Quality Dashboard
            </CardTitle>
            <CardDescription>
              Tracking data completeness across {data.totalFarms} farms
            </CardDescription>
          </div>
          <div className={`px-4 py-2 rounded-lg ${status.bg} text-center`}>
            <p className={`text-2xl font-bold ${status.color}`}>
              {data.overallQualityScore.toFixed(0)}%
            </p>
            <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Four Metric Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<MapPin className="h-4 w-4" />}
            label="GPS Coverage"
            value={data.overallGpsCoverage}
            color="text-blue-600"
          />
          <MetricCard
            icon={<Scale className="h-4 w-4" />}
            label="Weight Data"
            value={data.overallWeightCompleteness}
            color="text-purple-600"
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Production Tracking"
            value={data.overallProductionTracking}
            color="text-green-600"
          />
          <MetricCard
            icon={<Stethoscope className="h-4 w-4" />}
            label="Health Recording"
            value={data.overallHealthRecording}
            color="text-orange-600"
          />
        </div>

        {/* Regions Needing Attention */}
        {data.regionsNeedingAttention.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {data.regionsNeedingAttention.length} regions need attention
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              These regions have quality scores below 50% and may require extension support
            </p>
          </div>
        )}

        {/* Collapsible Regional Breakdown */}
        {data.regions.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded px-2">
              <span>Regional Breakdown ({data.regions.length} regions)</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {data.regions
                  .sort((a, b) => a.overall_quality_score - b.overall_quality_score)
                  .map((region, index) => (
                    <RegionRow key={`${region.region}-${region.province}-${index}`} region={region} />
                  ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

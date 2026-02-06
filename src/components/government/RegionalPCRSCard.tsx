import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRegionalPCRS, RegionalPCRSData } from "@/hooks/useRegionalPCRS";
import { DataCategory } from "@/types/government";
import { PCRS_TIERS } from "@/lib/urgencyGlossary";
import { Baby, AlertCircle, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { useState } from "react";
import { format, parseISO } from "date-fns";

interface RegionalPCRSCardProps {
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory: DataCategory;
}

interface TierBadgeProps {
  tier: 'critical' | 'high' | 'moderate' | 'low';
  count: number;
}

const TierBadge = ({ tier, count }: TierBadgeProps) => {
  const tierConfig = PCRS_TIERS[tier];
  const icons = {
    critical: <AlertCircle className="h-3 w-3" />,
    high: <AlertTriangle className="h-3 w-3" />,
    moderate: <Clock className="h-3 w-3" />,
    low: <CheckCircle className="h-3 w-3" />,
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${tierConfig.bgClass}`}>
      <span className={tierConfig.textClass}>{icons[tier]}</span>
      <div>
        <p className={`text-lg font-bold ${tierConfig.textClass}`}>{count}</p>
        <p className="text-xs text-muted-foreground">{tierConfig.label}</p>
      </div>
    </div>
  );
};

const RegionRiskRow = ({ region }: { region: RegionalPCRSData }) => {
  const getTierFromScore = (score: number) => {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'moderate';
    return 'low';
  };

  const tier = getTierFromScore(region.avg_risk_score);
  const tierConfig = PCRS_TIERS[tier];

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium">{region.region}</p>
        <p className="text-xs text-muted-foreground">{region.province}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right text-xs">
          <span className="text-muted-foreground">{region.total_pregnant} pregnant</span>
          <div className="flex gap-1 mt-1">
            {region.critical_count > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {region.critical_count} critical
              </Badge>
            )}
            {region.high_count > 0 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-orange-600 border-orange-200">
                {region.high_count} high
              </Badge>
            )}
          </div>
        </div>
        <Badge 
          variant={tier === 'critical' ? 'destructive' : tier === 'high' ? 'outline' : 'secondary'} 
          className={`min-w-[50px] justify-center ${tier === 'high' ? 'text-orange-600 border-orange-200' : ''}`}
        >
          {region.avg_risk_score.toFixed(0)}
        </Badge>
      </div>
    </div>
  );
};

const MonthlyTimeline = ({ monthlyTotals }: { monthlyTotals: Record<string, { total: number; critical: number; high: number; moderate: number; low: number }> }) => {
  const sortedMonths = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6); // Show next 6 months

  if (sortedMonths.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No upcoming deliveries scheduled
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sortedMonths.map(([month, data]) => {
        const highRiskCount = data.critical + data.high;
        const highRiskPct = data.total > 0 ? (highRiskCount / data.total) * 100 : 0;
        
        return (
          <div key={month} className="flex items-center gap-3">
            <div className="w-16 text-xs text-muted-foreground">
              {format(parseISO(`${month}-01`), 'MMM yyyy')}
            </div>
            <div className="flex-1 flex items-center gap-1 h-6">
              {data.critical > 0 && (
                <div 
                  className="h-full bg-destructive rounded-sm" 
                  style={{ width: `${(data.critical / data.total) * 100}%` }}
                  title={`${data.critical} critical`}
                />
              )}
              {data.high > 0 && (
                <div 
                  className="h-full bg-orange-500 rounded-sm" 
                  style={{ width: `${(data.high / data.total) * 100}%` }}
                  title={`${data.high} high`}
                />
              )}
              {data.moderate > 0 && (
                <div 
                  className="h-full bg-yellow-500 rounded-sm" 
                  style={{ width: `${(data.moderate / data.total) * 100}%` }}
                  title={`${data.moderate} moderate`}
                />
              )}
              {data.low > 0 && (
                <div 
                  className="h-full bg-green-500 rounded-sm" 
                  style={{ width: `${(data.low / data.total) * 100}%` }}
                  title={`${data.low} low`}
                />
              )}
            </div>
            <div className="w-12 text-right">
              <span className="text-sm font-medium">{data.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RegionalPCRSCard = ({
  region,
  province,
  municipality,
  dataCategory,
}: RegionalPCRSCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, error } = useRegionalPCRS(
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
            <Baby className="h-5 w-5 text-primary" />
            Pre-Calving Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-primary" />
            Pre-Calving Risk Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load PCRS data
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTierFromScore = (score: number) => {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'moderate';
    return 'low';
  };

  const overallTier = getTierFromScore(data.avgRiskScore);
  const overallTierConfig = PCRS_TIERS[overallTier];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Baby className="h-5 w-5 text-primary" />
              Pre-Calving Risk Summary
            </CardTitle>
            <CardDescription>
              {data.totalPregnant} pregnant animals across {data.regions.length} regions
            </CardDescription>
          </div>
          <div className={`px-4 py-2 rounded-lg ${overallTierConfig.bgClass} text-center`}>
            <p className={`text-2xl font-bold ${overallTierConfig.textClass}`}>
              {data.avgRiskScore.toFixed(0)}
            </p>
            <p className={`text-xs font-medium ${overallTierConfig.textClass}`}>
              Avg PCRS
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tier Distribution */}
        <div className="grid grid-cols-4 gap-2">
          <TierBadge tier="critical" count={data.totalCritical} />
          <TierBadge tier="high" count={data.totalHigh} />
          <TierBadge tier="moderate" count={data.totalModerate} />
          <TierBadge tier="low" count={data.totalLow} />
        </div>

        {/* High Risk Alert */}
        {data.highRiskRegions.length > 0 && (
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-600">
                {data.highRiskRegions.length} high-risk regions
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              These regions have average PCRS ≥50 and may require veterinary resource allocation
            </p>
          </div>
        )}

        {/* Monthly Timeline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Expected Deliveries by Month</span>
          </div>
          <MonthlyTimeline monthlyTotals={data.monthlyTotals} />
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-destructive rounded-sm" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded-sm" />
              <span>High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm" />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span>Low</span>
            </div>
          </div>
        </div>

        {/* Collapsible Regional Breakdown */}
        {data.regions.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:bg-muted/50 rounded px-2">
              <span>Regional Risk Heatmap ({data.regions.length} regions)</span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="max-h-64 overflow-y-auto space-y-1">
                {data.regions.map((region, index) => (
                  <RegionRiskRow key={`${region.region}-${region.province}-${index}`} region={region} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

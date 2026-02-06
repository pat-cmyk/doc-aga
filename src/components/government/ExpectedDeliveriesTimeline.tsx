import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, TrendingUp } from "lucide-react";
import { format, parseISO, differenceInDays, isAfter, addDays } from "date-fns";
import { getPCRSTier, type PCRSTier } from "@/lib/urgencyGlossary";
import { DefinitionBadge } from "@/components/ui/definition-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpectedDeliveriesTimelineProps {
  deliveriesByMonth: Record<
    string,
    {
      total: number;
      by_type: Record<string, number>;
      // Optional PCRS summary data if available
      risk_summary?: {
        critical: number;
        high: number;
        moderate: number;
        low: number;
      };
    }
  >;
  isLoading?: boolean;
}

/**
 * Determine urgency based on actual delivery dates in the month
 * Fixed: Now checks if ANY delivery in the month falls within 30 days
 */
function calculateMonthUrgency(
  monthKey: string,
  now: Date
): { isUrgent: boolean; daysToFirstDelivery: number } {
  // Parse the month and get the last day of the month
  const monthStart = parseISO(`${monthKey}-01`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  
  // A month is urgent if its last day is still in the future AND
  // either the month has started or starts within 30 days
  const thirtyDaysFromNow = addDays(now, 30);
  
  // Check if any part of this month falls within the next 30 days
  const isUrgent = monthEnd >= now && monthStart <= thirtyDaysFromNow;
  
  // Calculate days to first delivery (assume deliveries start on the 15th if month hasn't started)
  const effectiveStart = isAfter(monthStart, now) ? monthStart : now;
  const daysToFirstDelivery = differenceInDays(effectiveStart, now);
  
  return { isUrgent, daysToFirstDelivery };
}

/**
 * Get the risk tier badge for a month based on PCRS summary
 */
function getMonthRiskBadge(
  riskSummary?: { critical: number; high: number; moderate: number; low: number },
  isUrgent: boolean = false
): PCRSTier | null {
  if (!riskSummary) {
    // Fallback to timeline-only urgency
    return isUrgent ? getPCRSTier(50) : null;
  }
  
  const total = riskSummary.critical + riskSummary.high + riskSummary.moderate + riskSummary.low;
  if (total === 0) return null;
  
  // If any critical, month is critical
  if (riskSummary.critical > 0) return getPCRSTier(75);
  
  // If >30% are high risk, month is high
  if (riskSummary.high / total > 0.3) return getPCRSTier(50);
  
  // If any high risk, month is moderate
  if (riskSummary.high > 0) return getPCRSTier(25);
  
  // Otherwise low or based on timeline urgency
  return isUrgent ? getPCRSTier(25) : getPCRSTier(0);
}

export const ExpectedDeliveriesTimeline = ({
  deliveriesByMonth,
  isLoading,
}: ExpectedDeliveriesTimelineProps) => {
  const sortedMonths = Object.keys(deliveriesByMonth).sort();
  const now = new Date();

  // Calculate total urgent/high-risk deliveries
  const urgentDeliveries = sortedMonths.reduce((count, monthKey) => {
    const { isUrgent } = calculateMonthUrgency(monthKey, now);
    if (isUrgent) {
      return count + deliveriesByMonth[monthKey].total;
    }
    return count;
  }, 0);

  // Count by risk tier if available
  const riskCounts = sortedMonths.reduce(
    (acc, monthKey) => {
      const summary = deliveriesByMonth[monthKey].risk_summary;
      if (summary) {
        acc.critical += summary.critical;
        acc.high += summary.high;
        acc.moderate += summary.moderate;
        acc.low += summary.low;
      }
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, low: 0 }
  );

  const hasRiskData = riskCounts.critical + riskCounts.high + riskCounts.moderate + riskCounts.low > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2" />
                <div className="h-8 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sortedMonths.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No upcoming deliveries</p>
              <p className="text-xs mt-1">Expected deliveries will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Expected Deliveries Timeline</CardTitle>
          {(hasRiskData ? riskCounts.critical + riskCounts.high > 0 : urgentDeliveries > 0) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="font-normal flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {hasRiskData
                      ? `${riskCounts.critical + riskCounts.high} high risk`
                      : `${urgentDeliveries} due in 30 days`}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {hasRiskData ? (
                    <div className="text-xs">
                      <p>🔴 Critical: {riskCounts.critical}</p>
                      <p>🟠 High: {riskCounts.high}</p>
                      <p>🟡 Moderate: {riskCounts.moderate}</p>
                      <p>🟢 Low: {riskCounts.low}</p>
                    </div>
                  ) : (
                    <p className="text-xs">Based on 30-day timeline urgency</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[300px] overflow-y-auto">
          {sortedMonths.slice(0, 8).map((monthKey) => {
            const delivery = deliveriesByMonth[monthKey];
            const monthDate = parseISO(`${monthKey}-01`);
            const { isUrgent, daysToFirstDelivery } = calculateMonthUrgency(monthKey, now);
            const riskTier = getMonthRiskBadge(delivery.risk_summary, isUrgent);

            return (
              <div
                key={monthKey}
                className={`space-y-2 pb-4 border-b last:border-0 ${
                  riskTier && (riskTier.tier === 'critical' || riskTier.tier === 'high')
                    ? riskTier.bgClass + ' -mx-4 px-4 rounded'
                    : isUrgent
                    ? 'bg-orange-500/5 -mx-4 px-4 rounded'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(monthDate, "MMMM yyyy")}</span>
                    {riskTier && riskTier.tier !== 'low' && (
                      <DefinitionBadge
                        label={riskTier.label}
                        description={`${riskTier.description}. Score range: ${riskTier.minScore}-${riskTier.maxScore} points.`}
                        variant={riskTier.badgeVariant}
                        className={`text-xs ${riskTier.textClass}`}
                      />
                    )}
                  </div>
                  <Badge variant="secondary">{delivery.total} total</Badge>
                </div>

                <div className="flex flex-wrap gap-2 ml-6">
                  {Object.entries(delivery.by_type).map(([type, count]) => (
                    <div
                      key={type}
                      className="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="capitalize">{type}: {count}</span>
                    </div>
                  ))}
                  {delivery.risk_summary && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                      <TrendingUp className="h-3 w-3" />
                      <span>
                        Risk: {delivery.risk_summary.critical}🔴 {delivery.risk_summary.high}🟠
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sortedMonths.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              And {sortedMonths.length - 8} more months...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

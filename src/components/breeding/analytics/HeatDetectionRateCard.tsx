/**
 * HeatDetectionRateCard - Displays heat detection rate with gauge and breakdown
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Thermometer, Eye, Activity, Zap } from 'lucide-react';
import { getHDRStatus } from '@/hooks/useBreedingAnalytics';
import { cn } from '@/lib/utils';

interface HeatDetectionRateCardProps {
  heatDetectionRate: number;
  expectedHeats: number;
  detectedHeats: number;
  avgCycleDays: number;
  openCyclingCount: number;
  methodBreakdown: Record<string, number>;
  periodDays: number;
  isLoading?: boolean;
}

export function HeatDetectionRateCard({
  heatDetectionRate,
  expectedHeats,
  detectedHeats,
  avgCycleDays,
  openCyclingCount,
  methodBreakdown,
  periodDays,
  isLoading = false,
}: HeatDetectionRateCardProps) {
  if (isLoading) {
    return <HeatDetectionRateSkeleton />;
  }
  
  const status = getHDRStatus(heatDetectionRate);
  
  const statusConfig = {
    excellent: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      progressColor: 'bg-green-500',
      label: 'Excellent',
    },
    good: {
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      progressColor: 'bg-yellow-500',
      label: 'Good',
    },
    needs_improvement: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      progressColor: 'bg-red-500',
      label: 'Needs Work',
    },
  };
  
  const config = statusConfig[status];
  
  // Method icons
  const methodIcons: Record<string, React.ReactNode> = {
    visual: <Eye className="h-3 w-3" />,
    mounting: <Activity className="h-3 w-3" />,
    behavioral: <Zap className="h-3 w-3" />,
    unknown: <Thermometer className="h-3 w-3" />,
  };
  
  const totalMethods = Object.values(methodBreakdown).reduce((a, b) => a + b, 0);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", config.bg)}>
            <Thermometer className={cn("h-4 w-4", config.color)} />
          </div>
          Heat Detection Rate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metric - Gauge Style */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", config.color)}>
                {heatDetectionRate > 0 ? Math.round(heatDetectionRate) : '0'}
              </span>
              <span className="text-lg text-muted-foreground">%</span>
            </div>
            <Badge variant="outline" className={cn("text-xs", config.bg, config.color)}>
              {config.label}
            </Badge>
          </div>
          
          {/* Progress Bar as Gauge */}
          <div className="relative">
            <Progress 
              value={Math.min(100, heatDetectionRate)} 
              className="h-3"
            />
            {/* Target markers */}
            <div className="absolute top-0 left-1/2 h-full w-0.5 bg-yellow-500/50" title="50% - Good" />
            <div className="absolute top-0 left-[70%] h-full w-0.5 bg-green-500/50" title="70% - Excellent" />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span className="text-yellow-600">50%</span>
            <span className="text-green-600">70%</span>
            <span>100%</span>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
          <div>
            <div className="text-lg font-semibold">{detectedHeats}</div>
            <div className="text-xs text-muted-foreground">Detected</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{expectedHeats}</div>
            <div className="text-xs text-muted-foreground">Expected</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{openCyclingCount}</div>
            <div className="text-xs text-muted-foreground">Cycling</div>
          </div>
        </div>
        
        {/* Detection Method Breakdown */}
        {totalMethods > 0 && (
          <div className="border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Detection Methods
            </div>
            <div className="space-y-1.5">
              {Object.entries(methodBreakdown).map(([method, count]) => {
                const percentage = (count / totalMethods) * 100;
                return (
                  <div key={method} className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {methodIcons[method] || methodIcons.unknown}
                    </span>
                    <span className="text-xs capitalize flex-1">{method}</span>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Period Info */}
        <div className="text-xs text-muted-foreground text-center border-t pt-2">
          Last {periodDays} days • {avgCycleDays}-day cycle assumed
        </div>
        
        {/* No Data State */}
        {openCyclingCount === 0 && detectedHeats === 0 && (
          <div className="text-center py-2 text-sm text-muted-foreground">
            <p>No cycling animals or heat records</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HeatDetectionRateSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-3 w-full mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

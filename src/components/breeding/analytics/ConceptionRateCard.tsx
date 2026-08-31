/**
 * ConceptionRateCard - Displays conception rate, days open, and 21-day pregnancy rate
 *
 * Gold-standard reproductive KPIs per veterinary science (Frontiers in Vet Science, 2022).
 * Follows the same card pattern as ServicesPerConceptionCard.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, CalendarClock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  getConceptionRateStatus,
  getDaysOpenStatus,
  CONCEPTION_RATE_BENCHMARKS,
  DAYS_OPEN_BENCHMARKS,
} from '@/hooks/useBreedingAnalytics';
import { cn } from '@/lib/utils';

interface ConceptionRateCardProps {
  conceptionRate: number;
  avgDaysOpen: number;
  twentyOneDayPregnancyRate: number;
  totalServices: number;
  confirmedPregnancies: number;
  isLoading?: boolean;
  primaryLivestockType?: string;
}

const STATUS_CONFIG = {
  excellent: {
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'Excellent',
    icon: TrendingUp,
  },
  good: {
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: 'Good',
    icon: Minus,
  },
  needs_improvement: {
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Needs Work',
    icon: TrendingDown,
  },
} as const;

export function ConceptionRateCard({
  conceptionRate,
  avgDaysOpen,
  twentyOneDayPregnancyRate,
  totalServices,
  confirmedPregnancies,
  isLoading = false,
  primaryLivestockType = 'cattle',
}: ConceptionRateCardProps) {
  if (isLoading) return <ConceptionRateCardSkeleton />;

  const crStatus = getConceptionRateStatus(conceptionRate, primaryLivestockType);
  const doStatus = avgDaysOpen > 0 ? getDaysOpenStatus(avgDaysOpen, primaryLivestockType) : 'good';
  const crConfig = STATUS_CONFIG[crStatus];
  const crBenchmarks = CONCEPTION_RATE_BENCHMARKS[primaryLivestockType as keyof typeof CONCEPTION_RATE_BENCHMARKS] || CONCEPTION_RATE_BENCHMARKS.cattle;
  const doBenchmarks = DAYS_OPEN_BENCHMARKS[primaryLivestockType as keyof typeof DAYS_OPEN_BENCHMARKS] || DAYS_OPEN_BENCHMARKS.cattle;

  const hasData = totalServices > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Conception & Pregnancy Rate
          </span>
          {hasData && (
            <Badge variant="outline" className={cn('text-xs', crConfig.bg, crConfig.color)}>
              {crConfig.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No AI records found for this period</p>
        ) : (
          <>
            {/* Primary: Conception Rate */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className={cn('text-2xl font-bold', crConfig.color)}>
                  {conceptionRate}%
                </span>
                <span className="text-sm text-muted-foreground">Conception Rate</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {confirmedPregnancies} confirmed / {totalServices} AI performed
              </p>
              <p className="text-xs text-muted-foreground">
                Target: ≥{crBenchmarks.excellent}% excellent, ≥{crBenchmarks.good}% good
              </p>
            </div>

            {/* 21-Day Pregnancy Rate */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  21-Day Pregnancy Rate
                </span>
                <span className={cn(
                  'text-sm font-semibold',
                  twentyOneDayPregnancyRate >= 25 ? 'text-green-600' :
                  twentyOneDayPregnancyRate >= 15 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {twentyOneDayPregnancyRate > 0 ? `${Math.round(twentyOneDayPregnancyRate)}%` : 'N/A'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                HDR × CR composite — target: ≥25%
              </p>
              {twentyOneDayPregnancyRate > 0 && (
                <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      twentyOneDayPregnancyRate >= 25 ? 'bg-green-500' :
                      twentyOneDayPregnancyRate >= 15 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(100, twentyOneDayPregnancyRate * 2)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Days Open */}
            {avgDaysOpen > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Avg. Days Open
                  </span>
                  <span className={cn(
                    'text-sm font-semibold',
                    STATUS_CONFIG[doStatus].color
                  )}>
                    {avgDaysOpen}d
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calving to conception — target: ≤{doBenchmarks.excellent}d excellent, ≤{doBenchmarks.good}d good
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConceptionRateCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

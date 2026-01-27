/**
 * CalvingIntervalCard - Displays calving interval metrics with distribution chart
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Baby, Clock, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { getCIStatus, CALVING_INTERVAL_BENCHMARKS, CalvingIntervalAnimal } from '@/hooks/useBreedingAnalytics';
import { cn } from '@/lib/utils';

interface CalvingIntervalCardProps {
  avgIntervalDays: number;
  distribution: { range: string; count: number; livestock: string }[];
  longestIntervalAnimals: CalvingIntervalAnimal[];
  animalsWithData: number;
  isLoading?: boolean;
  primaryLivestockType?: string;
}

export function CalvingIntervalCard({
  avgIntervalDays,
  distribution,
  longestIntervalAnimals,
  animalsWithData,
  isLoading = false,
  primaryLivestockType = 'cattle',
}: CalvingIntervalCardProps) {
  const navigate = useNavigate();
  
  if (isLoading) {
    return <CalvingIntervalSkeleton />;
  }
  
  const status = getCIStatus(avgIntervalDays, primaryLivestockType);
  const benchmarks = CALVING_INTERVAL_BENCHMARKS[primaryLivestockType as keyof typeof CALVING_INTERVAL_BENCHMARKS] || CALVING_INTERVAL_BENCHMARKS.cattle;
  
  const statusConfig = {
    optimal: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      label: 'Optimal',
    },
    acceptable: {
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      label: 'Acceptable',
    },
    too_long: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      label: 'Too Long',
    },
  };
  
  const config = statusConfig[status];
  
  // Colors for distribution bars
  const getBarColor = (range: string) => {
    if (range.includes('<365') || range.includes('365-400')) return 'hsl(var(--chart-2))'; // green
    if (range.includes('400-450')) return 'hsl(var(--chart-4))'; // yellow
    return 'hsl(var(--chart-1))'; // red/orange
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", config.bg)}>
            <Clock className={cn("h-4 w-4", config.color)} />
          </div>
          Calving Interval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metric */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", config.color)}>
                {avgIntervalDays > 0 ? Math.round(avgIntervalDays) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">days average</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn("text-xs", config.bg, config.color)}>
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {animalsWithData} animals
              </span>
            </div>
          </div>
        </div>
        
        {/* Distribution Chart */}
        {distribution.some(d => d.count > 0) && (
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 9 }} 
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={40}
                />
                <YAxis hide />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Benchmarks */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="flex justify-between">
            <span>Target ({primaryLivestockType}):</span>
            <span>
              <span className="text-green-600">≤{benchmarks.optimal}d</span>
              {' / '}
              <span className="text-yellow-600">≤{benchmarks.acceptable}d</span>
            </span>
          </div>
        </div>
        
        {/* Longest Intervals */}
        {longestIntervalAnimals.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">
              <AlertTriangle className="h-3 w-3" />
              Longest Intervals
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {longestIntervalAnimals.slice(0, 3).map((animal) => (
                <button
                  key={animal.id}
                  onClick={() => navigate(`/animal/${animal.id}`)}
                  className="flex justify-between w-full text-sm hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="truncate">
                    {animal.name || animal.ear_tag || 'Unknown'}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      animal.interval_days > benchmarks.acceptable 
                        ? "bg-red-50 text-red-700" 
                        : "bg-yellow-50 text-yellow-700"
                    )}
                  >
                    {animal.interval_days}d
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* No Data State */}
        {animalsWithData === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Baby className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No calving interval data yet</p>
            <p className="text-xs">Requires 2+ calvings per animal</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CalvingIntervalSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-5 w-24 mt-2" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

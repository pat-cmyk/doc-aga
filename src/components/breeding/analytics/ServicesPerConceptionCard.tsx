/**
 * ServicesPerConceptionCard - Displays SPC metric with status indicator
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, Minus, Syringe, AlertTriangle } from 'lucide-react';
import { getSPCStatus, SPC_BENCHMARKS, RepeatBreeder } from '@/hooks/useBreedingAnalytics';
import { cn } from '@/lib/utils';

interface ServicesPerConceptionCardProps {
  avgSPC: number;
  spcByLivestockType: Record<string, number>;
  repeatBreeders: RepeatBreeder[];
  totalServices: number;
  confirmedPregnancies: number;
  isLoading?: boolean;
  primaryLivestockType?: string;
}

export function ServicesPerConceptionCard({
  avgSPC,
  spcByLivestockType,
  repeatBreeders,
  totalServices,
  confirmedPregnancies,
  isLoading = false,
  primaryLivestockType = 'cattle',
}: ServicesPerConceptionCardProps) {
  const navigate = useNavigate();
  
  if (isLoading) {
    return <ServicesPerConceptionSkeleton />;
  }
  
  const status = getSPCStatus(avgSPC, primaryLivestockType);
  const benchmarks = SPC_BENCHMARKS[primaryLivestockType as keyof typeof SPC_BENCHMARKS] || SPC_BENCHMARKS.cattle;
  
  const statusConfig = {
    excellent: {
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      label: 'Excellent',
      icon: TrendingDown,
    },
    good: {
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      label: 'Good',
      icon: Minus,
    },
    needs_improvement: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      label: 'Needs Work',
      icon: TrendingUp,
    },
  };
  
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", config.bg)}>
            <Syringe className={cn("h-4 w-4", config.color)} />
          </div>
          Services per Conception
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Metric */}
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold", config.color)}>
                {avgSPC > 0 ? avgSPC.toFixed(1) : '—'}
              </span>
              <span className="text-sm text-muted-foreground">services/pregnancy</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="outline" className={cn("text-xs", config.bg, config.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="text-right text-sm text-muted-foreground">
            <div>{totalServices} AI services</div>
            <div>{confirmedPregnancies} confirmed</div>
          </div>
        </div>
        
        {/* Benchmarks */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="flex justify-between">
            <span>Target ({primaryLivestockType}):</span>
            <span>
              <span className="text-green-600">≤{benchmarks.excellent}</span>
              {' / '}
              <span className="text-yellow-600">≤{benchmarks.good}</span>
            </span>
          </div>
        </div>
        
        {/* Breakdown by Livestock */}
        {Object.keys(spcByLivestockType).length > 1 && (
          <div className="space-y-1 border-t pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">By Livestock Type</div>
            {Object.entries(spcByLivestockType).map(([type, spc]) => {
              const typeStatus = getSPCStatus(spc, type);
              const typeColor = statusConfig[typeStatus].color;
              
              return (
                <div key={type} className="flex justify-between text-sm">
                  <span className="capitalize">{type}</span>
                  <span className={cn("font-medium", typeColor)}>
                    {spc > 0 ? spc.toFixed(1) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Repeat Breeders Alert */}
        {repeatBreeders.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">
              <AlertTriangle className="h-3 w-3" />
              Repeat Breeders ({repeatBreeders.length})
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {repeatBreeders.slice(0, 3).map((animal) => (
                <button
                  key={animal.id}
                  onClick={() => navigate(`/animal/${animal.id}`)}
                  className="flex justify-between w-full text-sm hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="truncate">
                    {animal.name || animal.ear_tag || 'Unknown'}
                  </span>
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                    {animal.services_this_cycle}×
                  </Badge>
                </button>
              ))}
              {repeatBreeders.length > 3 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{repeatBreeders.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServicesPerConceptionSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-5 w-20 mt-2" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * BreedingSeasonCard - Displays seasonal breeding metrics
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Calendar, Sun, CloudRain, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreedingSeasonData {
  isActive: boolean;
  seasonName: string;
  aiThisSeason: number;
  conceptionRate: number;
}

interface BreedingSeasonCardProps {
  breedingSeason: BreedingSeasonData | null;
  isLoading?: boolean;
  onToggleSeason?: () => void;
}

export function BreedingSeasonCard({
  breedingSeason,
  isLoading = false,
}: BreedingSeasonCardProps) {
  if (isLoading) {
    return <BreedingSeasonSkeleton />;
  }
  
  if (!breedingSeason) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            Breeding Season
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Year-round breeding</p>
            <p className="text-xs">No seasonal restrictions configured</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const isWetSeason = breedingSeason.seasonName.toLowerCase().includes('wet');
  const SeasonIcon = isWetSeason ? CloudRain : Sun;
  const seasonColor = isWetSeason 
    ? 'text-blue-600 dark:text-blue-400' 
    : 'text-amber-600 dark:text-amber-400';
  const seasonBg = isWetSeason 
    ? 'bg-blue-50 dark:bg-blue-900/20' 
    : 'bg-amber-50 dark:bg-amber-900/20';
  
  // Conception rate status
  const getConceptionStatus = (rate: number) => {
    if (rate >= 60) return { label: 'Excellent', color: 'text-green-600' };
    if (rate >= 40) return { label: 'Good', color: 'text-yellow-600' };
    return { label: 'Low', color: 'text-red-600' };
  };
  
  const conceptionStatus = getConceptionStatus(breedingSeason.conceptionRate);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", seasonBg)}>
            <SeasonIcon className={cn("h-4 w-4", seasonColor)} />
          </div>
          Breeding Season
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Season Status */}
        <div className="flex items-center justify-between">
          <div>
            <div className={cn("text-xl font-semibold", seasonColor)}>
              {breedingSeason.seasonName}
            </div>
            <div className="text-xs text-muted-foreground">
              {isWetSeason ? 'June - November' : 'December - May'}
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-xs", seasonBg, seasonColor)}
          >
            {breedingSeason.isActive ? 'Active' : 'Upcoming'}
          </Badge>
        </div>
        
        {/* Season Metrics */}
        <div className="grid grid-cols-2 gap-4 border-t pt-3">
          {/* AI This Season */}
          <div className="text-center">
            <div className="text-2xl font-bold">
              {breedingSeason.aiThisSeason}
            </div>
            <div className="text-xs text-muted-foreground">AI Services</div>
          </div>
          
          {/* Conception Rate */}
          <div className="text-center">
            <div className={cn("text-2xl font-bold", conceptionStatus.color)}>
              {breedingSeason.conceptionRate > 0 
                ? `${Math.round(breedingSeason.conceptionRate)}%`
                : '—'
              }
            </div>
            <div className="text-xs text-muted-foreground">Conception Rate</div>
          </div>
        </div>
        
        {/* Conception Rate Bar */}
        {breedingSeason.aiThisSeason > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Conception Rate</span>
              <span className={conceptionStatus.color}>{conceptionStatus.label}</span>
            </div>
            <Progress 
              value={breedingSeason.conceptionRate} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                60%
              </span>
              <span>100%</span>
            </div>
          </div>
        )}
        
        {/* Season Timeline Visual */}
        <div className="border-t pt-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Season Timeline
          </div>
          <div className="flex h-4 rounded-full overflow-hidden bg-muted">
            {/* Dry Season (Dec-May) */}
            <div 
              className={cn(
                "flex-1 flex items-center justify-center text-[10px] font-medium transition-colors",
                !isWetSeason ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200" : "bg-muted-foreground/10"
              )}
            >
              Dry
            </div>
            {/* Wet Season (Jun-Nov) */}
            <div 
              className={cn(
                "flex-1 flex items-center justify-center text-[10px] font-medium transition-colors",
                isWetSeason ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200" : "bg-muted-foreground/10"
              )}
            >
              Wet
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Dec</span>
            <span>Jun</span>
            <span>Nov</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreedingSeasonSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

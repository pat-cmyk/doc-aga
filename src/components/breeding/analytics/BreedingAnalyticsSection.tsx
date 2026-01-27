/**
 * BreedingAnalyticsSection - Container for all breeding analytics cards
 * 
 * Provides a responsive grid layout for the four core breeding metrics.
 */

import React from 'react';
import { useBreedingAnalytics } from '@/hooks/useBreedingAnalytics';
import { ServicesPerConceptionCard } from './ServicesPerConceptionCard';
import { CalvingIntervalCard } from './CalvingIntervalCard';
import { HeatDetectionRateCard } from './HeatDetectionRateCard';
import { BreedingSeasonCard } from './BreedingSeasonCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';

interface BreedingAnalyticsSectionProps {
  farmId: string | null;
  primaryLivestockType?: string;
}

export function BreedingAnalyticsSection({ 
  farmId,
  primaryLivestockType = 'cattle',
}: BreedingAnalyticsSectionProps) {
  const [periodDays, setPeriodDays] = React.useState(90);
  const [showSeasonal, setShowSeasonal] = React.useState(true);
  
  const analytics = useBreedingAnalytics(farmId, {
    periodDays,
    enableSeasonalView: showSeasonal,
  });
  
  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Breeding Performance Analytics
        </h3>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select 
            value={periodDays.toString()} 
            onValueChange={(v) => setPeriodDays(parseInt(v))}
          >
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Services per Conception */}
        <ServicesPerConceptionCard
          avgSPC={analytics.avgServicesPerConception}
          spcByLivestockType={analytics.spcByLivestockType}
          repeatBreeders={analytics.repeatBreeders}
          totalServices={analytics.totalAIServices}
          confirmedPregnancies={analytics.totalConfirmedPregnancies}
          isLoading={analytics.isLoading}
          primaryLivestockType={primaryLivestockType}
        />
        
        {/* Calving Interval */}
        <CalvingIntervalCard
          avgIntervalDays={analytics.avgCalvingIntervalDays}
          distribution={analytics.calvingIntervalDistribution}
          longestIntervalAnimals={analytics.longestIntervalAnimals}
          animalsWithData={analytics.animalsWithIntervalData}
          isLoading={analytics.isLoading}
          primaryLivestockType={primaryLivestockType}
        />
        
        {/* Heat Detection Rate */}
        <HeatDetectionRateCard
          heatDetectionRate={analytics.heatDetectionRate}
          expectedHeats={analytics.expectedHeats}
          detectedHeats={analytics.detectedHeats}
          avgCycleDays={analytics.avgCycleLengthDays}
          openCyclingCount={analytics.openCyclingCount}
          methodBreakdown={analytics.detectionMethodBreakdown}
          periodDays={periodDays}
          isLoading={analytics.isLoading}
        />
        
        {/* Breeding Season */}
        <BreedingSeasonCard
          breedingSeason={analytics.breedingSeason}
          isLoading={analytics.isLoading}
        />
      </div>
    </div>
  );
}

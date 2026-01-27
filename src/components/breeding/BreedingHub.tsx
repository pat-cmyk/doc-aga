/**
 * BreedingHub - Unified Breeding Management Dashboard
 * 
 * Farm-level view of all breeding activities with actionable alerts
 * and quick access to common breeding operations.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Plus, Calendar, Baby, AlertTriangle } from 'lucide-react';
import { useBreedingHub } from '@/hooks/useBreedingHub';
import { BreedingHubStatCard } from './BreedingHubStatCard';
import { BreedingActionCard } from './BreedingActionCard';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';

interface BreedingHubProps {
  farmId: string | null;
  onRecordHeat?: (animalId?: string) => void;
  onScheduleAI?: (animalId?: string) => void;
  onConfirmPregnancy?: (animalId?: string) => void;
}

export function BreedingHub({
  farmId,
  onRecordHeat,
  onScheduleAI,
  onConfirmPregnancy,
}: BreedingHubProps) {
  const navigate = useNavigate();
  const {
    stats,
    actionsToday,
    expectedHeatNext7Days,
    expectedDeliveriesNext30Days,
    isLoading,
  } = useBreedingHub(farmId);

  const handleViewAnimal = (animalId: string) => {
    navigate(`/animal/${animalId}`);
  };

  if (isLoading) {
    return <BreedingHubSkeleton />;
  }

  const totalBreedingEligible = stats.openCycling + stats.inHeat + stats.bredWaiting + 
    stats.suspectedPregnant + stats.confirmedPregnant + stats.freshPostpartum;

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900/30">
            <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Breeding Hub</h2>
            <p className="text-sm text-muted-foreground">
              {totalBreedingEligible} breeding eligible animals
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRecordHeat?.()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Record Heat
          </Button>
          <Button
            size="sm"
            onClick={() => onScheduleAI?.()}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Schedule AI
          </Button>
        </div>
      </div>

      {/* Status Summary Grid */}
      <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <BreedingHubStatCard
          count={stats.openCycling}
          label="Open"
          icon={FERTILITY_STATUS_CONFIG.open_cycling.icon}
          colorClass="text-green-600 dark:text-green-400"
          bgClass="bg-green-50 dark:bg-green-900/20"
        />
        <BreedingHubStatCard
          count={stats.inHeat}
          label="In Heat"
          icon={FERTILITY_STATUS_CONFIG.in_heat.icon}
          colorClass="text-orange-600 dark:text-orange-400"
          bgClass="bg-orange-50 dark:bg-orange-900/20"
          isHighlighted={stats.inHeat > 0}
        />
        <BreedingHubStatCard
          count={stats.bredWaiting}
          label="Waiting"
          icon={FERTILITY_STATUS_CONFIG.bred_waiting.icon}
          colorClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-50 dark:bg-blue-900/20"
        />
        <BreedingHubStatCard
          count={stats.pregCheckDue}
          label="Preg Check"
          icon="🔍"
          colorClass="text-purple-600 dark:text-purple-400"
          bgClass="bg-purple-50 dark:bg-purple-900/20"
          isHighlighted={stats.pregCheckDue > 0}
        />
        <BreedingHubStatCard
          count={stats.suspectedPregnant}
          label="Suspected"
          icon={FERTILITY_STATUS_CONFIG.suspected_pregnant.icon}
          colorClass="text-purple-600 dark:text-purple-400"
          bgClass="bg-purple-50 dark:bg-purple-900/20"
        />
        <BreedingHubStatCard
          count={stats.confirmedPregnant}
          label="Pregnant"
          icon={FERTILITY_STATUS_CONFIG.confirmed_pregnant.icon}
          colorClass="text-pink-600 dark:text-pink-400"
          bgClass="bg-pink-50 dark:bg-pink-900/20"
        />
        <BreedingHubStatCard
          count={stats.freshPostpartum}
          label="Fresh"
          icon={FERTILITY_STATUS_CONFIG.fresh_postpartum.icon}
          colorClass="text-teal-600 dark:text-teal-400"
          bgClass="bg-teal-50 dark:bg-teal-900/20"
        />
        <BreedingHubStatCard
          count={stats.notEligible}
          label="Not Ready"
          icon={FERTILITY_STATUS_CONFIG.not_eligible.icon}
          colorClass="text-muted-foreground"
          bgClass="bg-muted/50"
        />
      </div>

      {/* Actions Required Today */}
      {actionsToday.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Action Required Today
              <Badge variant="destructive" className="ml-auto">
                {actionsToday.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actionsToday.slice(0, 5).map((action, idx) => (
                <BreedingActionCard
                  key={`${action.animal.id}-${action.type}-${idx}`}
                  action={action}
                  onViewAnimal={handleViewAnimal}
                  onScheduleAI={onScheduleAI}
                  onRecordHeat={onRecordHeat}
                  onConfirmPregnancy={onConfirmPregnancy}
                />
              ))}
              {actionsToday.length > 5 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  +{actionsToday.length - 5} more actions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Predictions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Expected Heat */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-orange-500" />
              Expected Heat (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expectedHeatNext7Days.length > 0 ? (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {expectedHeatNext7Days.map((action, idx) => (
                    <div
                      key={`heat-${action.animal.id}-${idx}`}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                    >
                      <button
                        onClick={() => handleViewAnimal(action.animal.id)}
                        className="text-sm font-medium hover:underline truncate"
                      >
                        {action.animal.name || action.animal.ear_tag}
                      </button>
                      <Badge variant={action.urgency === 'today' ? 'default' : 'outline'}>
                        {action.description}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No heat events predicted this week
              </p>
            )}
          </CardContent>
        </Card>

        {/* Expected Deliveries */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4 text-pink-500" />
              Expected Deliveries (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expectedDeliveriesNext30Days.length > 0 ? (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {expectedDeliveriesNext30Days.map((action, idx) => (
                    <div
                      key={`delivery-${action.animal.id}-${idx}`}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                    >
                      <button
                        onClick={() => handleViewAnimal(action.animal.id)}
                        className="text-sm font-medium hover:underline truncate"
                      >
                        {action.animal.name || action.animal.ear_tag}
                      </button>
                      <Badge
                        variant={action.urgency === 'now' ? 'destructive' : 'outline'}
                        className={action.urgency === 'soon' ? 'bg-orange-100 text-orange-700' : ''}
                      >
                        {action.description}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No deliveries expected in the next 30 days
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BreedingHubSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

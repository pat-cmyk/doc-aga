/**
 * BreedingHub - Unified Breeding Management Dashboard
 * 
 * Farm-level view of all breeding activities with actionable alerts
 * and quick access to common breeding operations.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BreedingStatusAnimalList } from './BreedingStatusAnimalList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Plus, Calendar, Baby, AlertTriangle, BarChart3, Search } from 'lucide-react';
import { BreedingAnimalSearchDialog } from './BreedingAnimalSearchDialog';
import { FarmRecordHeatDialog } from './FarmRecordHeatDialog';
import { FarmScheduleAIDialog } from './FarmScheduleAIDialog';
import { useBreedingHub } from '@/hooks/useBreedingHub';
import { BreedingHubStatCard } from './BreedingHubStatCard';
import { BreedingActionCard } from './BreedingActionCard';
import { BreedingAnalyticsSection } from './analytics';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';

interface BreedingHubProps {
  farmId: string | null;
  livestockType?: string;
}

export function BreedingHub({
  farmId,
  livestockType = 'cattle',
}: BreedingHubProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [heatDialogOpen, setHeatDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [preselectedAnimalForAI, setPreselectedAnimalForAI] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    stats,
    actionsToday,
    expectedHeatNext7Days,
    expectedDeliveriesNext30Days,
    animals,
    isLoading,
  } = useBreedingHub(farmId);

  // Build preg-check animal IDs from actionsToday
  const pregCheckAnimalIds = useMemo(
    () => new Set(actionsToday.filter(a => a.type === 'preg_check_due').map(a => a.animal.id)),
    [actionsToday],
  );

  // Status-to-filter mapping
  const STATUS_FILTER_MAP: Record<string, (a: typeof animals[0]) => boolean> = useMemo(() => ({
    open_cycling: (a) => a.fertility_status === 'open_cycling',
    in_heat: (a) => a.fertility_status === 'in_heat',
    bred_pipeline: (a) => a.fertility_status === 'bred_waiting' || a.fertility_status === 'suspected_pregnant' || pregCheckAnimalIds.has(a.id),
    confirmed_pregnant: (a) => a.fertility_status === 'confirmed_pregnant',
    fresh_postpartum: (a) => a.fertility_status === 'fresh_postpartum',
    not_eligible: (a) => !a.fertility_status || a.fertility_status === 'not_eligible',
  }), [pregCheckAnimalIds]);

  const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
    open_cycling: { label: 'Open', icon: FERTILITY_STATUS_CONFIG.open_cycling.icon },
    in_heat: { label: 'In Heat', icon: FERTILITY_STATUS_CONFIG.in_heat.icon },
    bred_pipeline: { label: 'Bred', icon: '🧬' },
    confirmed_pregnant: { label: 'Pregnant', icon: FERTILITY_STATUS_CONFIG.confirmed_pregnant.icon },
    fresh_postpartum: { label: 'Fresh', icon: FERTILITY_STATUS_CONFIG.fresh_postpartum.icon },
    not_eligible: { label: 'Not Ready', icon: FERTILITY_STATUS_CONFIG.not_eligible.icon },
  };

  const filteredAnimals = useMemo(() => {
    if (!selectedStatus) return [];
    const filterFn = STATUS_FILTER_MAP[selectedStatus];
    return filterFn ? animals.filter(filterFn) : [];
  }, [selectedStatus, animals, STATUS_FILTER_MAP]);

  const handleViewAnimal = (animalId: string) => {
    navigate(`/?tab=animals&animalId=${animalId}`);
  };

  if (isLoading) {
    return <BreedingHubSkeleton />;
  }

  const totalBreedingEligible = stats.openCycling + stats.inHeat + stats.bredWaiting + 
    stats.suspectedPregnant + stats.confirmedPregnant + stats.freshPostpartum;

  return (
    <div className="space-y-4">
      {/* Header with Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-pink-100 dark:bg-pink-900/30">
            <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Breeding Hub</h2>
            <p className="text-sm text-muted-foreground">
              {animals.length} hayop / animals ({totalBreedingEligible} breeding eligible)
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4 mr-1" />
            Search
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setHeatDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Record Heat
          </Button>
          <Button
            size="sm"
            onClick={() => setAiDialogOpen(true)}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Schedule AI
          </Button>
        </div>
      </div>

      {/* Tabs for Overview and Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
          <TabsTrigger value="overview" className="text-sm">
            <Heart className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-sm">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Status Summary Grid */}
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <BreedingHubStatCard
              count={stats.openCycling}
              label="Open"
              description={FERTILITY_STATUS_CONFIG.open_cycling.description}
              descriptionTagalog={FERTILITY_STATUS_CONFIG.open_cycling.descriptionTagalog}
              icon={FERTILITY_STATUS_CONFIG.open_cycling.icon}
              colorClass="text-green-600 dark:text-green-400"
              bgClass="bg-green-50 dark:bg-green-900/20"
              onClick={() => setSelectedStatus('open_cycling')}
            />
            <BreedingHubStatCard
              count={stats.inHeat}
              label="In Heat"
              description={FERTILITY_STATUS_CONFIG.in_heat.description}
              descriptionTagalog={FERTILITY_STATUS_CONFIG.in_heat.descriptionTagalog}
              icon={FERTILITY_STATUS_CONFIG.in_heat.icon}
              colorClass="text-orange-600 dark:text-orange-400"
              bgClass="bg-orange-50 dark:bg-orange-900/20"
              isHighlighted={stats.inHeat > 0}
              onClick={() => setSelectedStatus('in_heat')}
            />
            <BreedingHubStatCard
              count={stats.bredWaiting + stats.suspectedPregnant}
              label="Bred"
              description="Animals that have been bred and are awaiting pregnancy confirmation"
              descriptionTagalog="Mga hayop na na-breed at naghihintay ng kumpirmasyon ng pagbubuntis"
              icon="🧬"
              colorClass="text-blue-600 dark:text-blue-400"
              bgClass="bg-blue-50 dark:bg-blue-900/20"
              isHighlighted={stats.pregCheckDue > 0}
              badge={stats.pregCheckDue > 0 ? `${stats.pregCheckDue} preg check due` : undefined}
              onClick={() => setSelectedStatus('bred_pipeline')}
            />
            <BreedingHubStatCard
              count={stats.confirmedPregnant}
              label="Pregnant"
              description={FERTILITY_STATUS_CONFIG.confirmed_pregnant.description}
              descriptionTagalog={FERTILITY_STATUS_CONFIG.confirmed_pregnant.descriptionTagalog}
              icon={FERTILITY_STATUS_CONFIG.confirmed_pregnant.icon}
              colorClass="text-pink-600 dark:text-pink-400"
              bgClass="bg-pink-50 dark:bg-pink-900/20"
              onClick={() => setSelectedStatus('confirmed_pregnant')}
            />
            <BreedingHubStatCard
              count={stats.freshPostpartum}
              label="Fresh"
              description={FERTILITY_STATUS_CONFIG.fresh_postpartum.description}
              descriptionTagalog={FERTILITY_STATUS_CONFIG.fresh_postpartum.descriptionTagalog}
              icon={FERTILITY_STATUS_CONFIG.fresh_postpartum.icon}
              colorClass="text-teal-600 dark:text-teal-400"
              bgClass="bg-teal-50 dark:bg-teal-900/20"
              onClick={() => setSelectedStatus('fresh_postpartum')}
            />
            <BreedingHubStatCard
              count={stats.notEligible}
              label="Not Ready"
              description="Males, too young, or not yet ready"
              descriptionTagalog="Lalaki, masyadong bata, o hindi pa handa"
              icon={FERTILITY_STATUS_CONFIG.not_eligible.icon}
              colorClass="text-muted-foreground"
              bgClass="bg-muted/50"
              onClick={() => setSelectedStatus('not_eligible')}
              badge={stats.maleCount > 0 ? `${stats.maleCount} lalaki / male` : undefined}
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
                      onScheduleAI={() => { setPreselectedAnimalForAI(action.animal.id); setAiDialogOpen(true); }}
                      onRecordHeat={() => setHeatDialogOpen(true)}
                      onConfirmPregnancy={() => {}}
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
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <BreedingAnalyticsSection 
            farmId={farmId} 
            primaryLivestockType={livestockType}
          />
        </TabsContent>
      </Tabs>

      {/* Drill-down dialog */}
      <BreedingStatusAnimalList
        open={!!selectedStatus}
        onClose={() => setSelectedStatus(null)}
        statusLabel={selectedStatus ? STATUS_LABELS[selectedStatus]?.label || '' : ''}
        statusIcon={selectedStatus ? STATUS_LABELS[selectedStatus]?.icon || '' : ''}
        animals={filteredAnimals}
      />

      {/* Animal Search Dialog */}
      <BreedingAnimalSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        animals={animals}
      />

      {/* Farm-level Record Heat Dialog */}
      <FarmRecordHeatDialog
        open={heatDialogOpen}
        onOpenChange={setHeatDialogOpen}
        animals={animals}
        farmId={farmId}
      />

      {/* Farm-level Schedule AI Dialog */}
      <FarmScheduleAIDialog
        open={aiDialogOpen}
        onOpenChange={(open) => { setAiDialogOpen(open); if (!open) setPreselectedAnimalForAI(null); }}
        animals={animals}
        farmId={farmId}
        preselectedAnimalId={preselectedAnimalForAI}
      />
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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

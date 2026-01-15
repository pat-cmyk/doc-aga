import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Eye, 
  Milk, 
  Wheat, 
  Users, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  Heart,
  X
} from 'lucide-react';
import { useDailyActivityCompliance } from '@/hooks/useDailyActivityCompliance';
import { useDailyHeatMonitoring } from '@/hooks/useDailyHeatMonitoring';
import { useHeatObservationChecks } from '@/hooks/useHeatObservationChecks';
import { useOperationDialogs } from '@/hooks/useOperationDialogs';
import { OperationDialogs } from '@/components/operations/OperationDialogs';
import { useNavigate } from 'react-router-dom';

interface DailyActivityComplianceProps {
  farmId: string;
}

export function DailyActivityCompliance({ farmId }: DailyActivityComplianceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [breedingPopoverOpen, setBreedingPopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { data: compliance, isLoading } = useDailyActivityCompliance(farmId);
  const { data: heatData } = useDailyHeatMonitoring(farmId);
  const { markAsChecked, checkedAnimalIds } = useHeatObservationChecks(farmId);
  const {
    isRecordFeedOpen,
    isRecordMilkOpen,
    openFeedDialog: handleRecordFeed,
    openMilkDialog: handleRecordMilk,
    setRecordFeedOpen,
    setRecordMilkOpen,
  } = useOperationDialogs();

  // Combine overdue and needs observation animals, filtering out already checked ones
  const animalsNeedingCheck = [
    ...(heatData?.overdueAnimals || []).map(a => ({ ...a, priority: 'overdue' as const })),
    ...(heatData?.animalsNeedingObservation || [])
      .filter(a => !checkedAnimalIds.has(a.id))
      .map(a => ({ ...a, priority: 'check' as const })),
  ];

  const handleBreedingClick = () => {
    if (animalsNeedingCheck.length === 1) {
      // Single animal - navigate directly to profile
      navigate(`/?tab=animals&animalId=${animalsNeedingCheck[0].id}`);
    } else if (animalsNeedingCheck.length > 1) {
      // Multiple animals - open selection popover
      setBreedingPopoverOpen(true);
    } else {
      // No animals need attention - go to breeding tab
      navigate('/?tab=operations&subtab=breeding');
    }
  };

  const handleSelectAnimal = (animalId: string) => {
    setBreedingPopoverOpen(false);
    navigate(`/?tab=animals&animalId=${animalId}`);
  };

  const handleMarkNoHeat = (animalId: string) => {
    markAsChecked.mutate(animalId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!compliance) return null;

  const { 
    milkingCompliancePercent, 
    completedMilkingSessions,
    expectedMilkingSessions,
    hasFeedingToday,
    completedFeedingSessions,
    farmhandActivity,
    lactatingAnimalsCount,
    totalAnimalsCount
  } = compliance;

  // Skip if no animals
  if (lactatingAnimalsCount === 0 && totalAnimalsCount === 0) {
    return null;
  }

  const activeFarmhands = farmhandActivity.filter(f => f.activitiesCount > 0);
  const breedingNeedsAttention = animalsNeedingCheck.length;

  const getMilkingStatusColor = () => {
    if (milkingCompliancePercent >= 80) return 'text-green-600 dark:text-green-400';
    if (milkingCompliancePercent >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Today At A Glance
                <Badge variant="outline" className="ml-1 text-xs">
                  {new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Compact Grid Layout */}
            <div className="grid grid-cols-2 gap-3">
              {/* Milking Status */}
              {lactatingAnimalsCount > 0 && (
                <button
                  onClick={handleRecordMilk}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Milk className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Milking</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold ${getMilkingStatusColor()}`}>
                      {completedMilkingSessions.total}/{expectedMilkingSessions}
                    </span>
                  </div>
                  <Progress 
                    value={milkingCompliancePercent} 
                    className="h-1.5 mt-2"
                  />
                  {milkingCompliancePercent === 100 && (
                    <div className="flex items-center gap-1 mt-1.5 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="text-xs">Done</span>
                    </div>
                  )}
                </button>
              )}

              {/* Feeding Status */}
              <button
                onClick={handleRecordFeed}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Wheat className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Feeding</span>
                </div>
                {hasFeedingToday ? (
                  <>
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-semibold">Done</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{completedFeedingSessions} records</p>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">0</span>
                    <p className="text-xs text-muted-foreground mt-1">Not recorded</p>
                  </>
                )}
              </button>

              {/* Breeding Status with Popover */}
              {heatData && heatData.breedingEligibleCount > 0 && (
                <Popover open={breedingPopoverOpen} onOpenChange={setBreedingPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={handleBreedingClick}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30">
                          <Heart className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">Breeding</span>
                      </div>
                      {breedingNeedsAttention > 0 ? (
                        <>
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {breedingNeedsAttention}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">Need observation</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-semibold">On track</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{heatData.pregnantCount} pregnant</p>
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Animals needing heat observation:
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setBreedingPopoverOpen(false)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {animalsNeedingCheck.map(animal => (
                        <div 
                          key={animal.id} 
                          className="flex items-center justify-between p-2 rounded-md border bg-card"
                        >
                          <button
                            onClick={() => handleSelectAnimal(animal.id)}
                            className="flex-1 text-left hover:underline min-w-0"
                          >
                            <span className="text-sm font-medium truncate block">
                              {animal.name || animal.earTag || 'Unknown'}
                            </span>
                          </button>
                          <div className="flex items-center gap-2 ml-2 shrink-0">
                            <Badge 
                              variant={animal.priority === 'overdue' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {animal.priority === 'overdue' ? 'Overdue' : 'Check'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkNoHeat(animal.id);
                              }}
                              disabled={markAsChecked.isPending}
                            >
                              <X className="h-3 w-3 mr-1" />
                              No Heat
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                      Click name to view profile, or mark as checked if no heat observed.
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Team Activity */}
              {farmhandActivity.length > 0 && (
                <div className="p-3 rounded-lg border bg-card text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Team</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold ${activeFarmhands.length > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {activeFarmhands.length}/{farmhandActivity.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Active today</p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <OperationDialogs
        farmId={farmId}
        isRecordFeedOpen={isRecordFeedOpen}
        onRecordFeedOpenChange={setRecordFeedOpen}
        isRecordMilkOpen={isRecordMilkOpen}
        onRecordMilkOpenChange={setRecordMilkOpen}
      />
    </Card>
  );
}
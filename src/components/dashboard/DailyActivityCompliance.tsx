import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Eye, 
  Milk, 
  Wheat, 
  Users, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  Heart
} from 'lucide-react';
import { useDailyActivityCompliance } from '@/hooks/useDailyActivityCompliance';
import { useDailyHeatMonitoring } from '@/hooks/useDailyHeatMonitoring';
import { useOperationDialogs } from '@/hooks/useOperationDialogs';
import { OperationDialogs } from '@/components/operations/OperationDialogs';
import { useNavigate } from 'react-router-dom';

interface DailyActivityComplianceProps {
  farmId: string;
}

export function DailyActivityCompliance({ farmId }: DailyActivityComplianceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const { data: compliance, isLoading } = useDailyActivityCompliance(farmId);
  const { data: heatData } = useDailyHeatMonitoring(farmId);
  const {
    isRecordFeedOpen,
    isRecordMilkOpen,
    openFeedDialog: handleRecordFeed,
    openMilkDialog: handleRecordMilk,
    setRecordFeedOpen,
    setRecordMilkOpen,
  } = useOperationDialogs();

  const handleRecordHeat = () => {
    navigate('/?tab=operations&subtab=breeding');
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
  const breedingNeedsAttention = (heatData?.animalsNeedingObservation.length || 0) + (heatData?.overdueAnimals.length || 0);

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

              {/* Breeding Status */}
              {heatData && heatData.breedingEligibleCount > 0 && (
                <button
                  onClick={handleRecordHeat}
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
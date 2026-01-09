import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ClipboardCheck, 
  Milk, 
  Wheat, 
  Users, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDailyActivityCompliance } from '@/hooks/useDailyActivityCompliance';
import { RecordBulkFeedDialog } from '@/components/feed-recording/RecordBulkFeedDialog';
import { RecordBulkMilkDialog } from '@/components/milk-recording/RecordBulkMilkDialog';

interface DailyActivityComplianceProps {
  farmId: string;
}

export function DailyActivityCompliance({ farmId }: DailyActivityComplianceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isRecordFeedOpen, setIsRecordFeedOpen] = useState(false);
  const [isRecordMilkOpen, setIsRecordMilkOpen] = useState(false);
  const { data: compliance, isLoading } = useDailyActivityCompliance(farmId);

  const handleRecordFeed = () => {
    setIsRecordFeedOpen(true);
  };

  const handleRecordMilk = () => {
    setIsRecordMilkOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
    animalsMissingMilking,
    feedingCompliancePercent,
    completedFeedingSessions,
    hasFeedingToday,
    farmhandActivity,
    isAfternoon,
    lactatingAnimalsCount
  } = compliance;

  // Skip if no lactating animals
  if (lactatingAnimalsCount === 0 && compliance.totalAnimalsCount === 0) {
    return null;
  }

  const getMilkingStatusColor = () => {
    if (milkingCompliancePercent >= 80) return 'text-green-600';
    if (milkingCompliancePercent >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getMilkingProgressColor = () => {
    if (milkingCompliancePercent >= 80) return 'bg-green-500';
    if (milkingCompliancePercent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const activeFarmhands = farmhandActivity.filter(f => f.activitiesCount > 0);
  const inactiveFarmhands = farmhandActivity.filter(f => f.activitiesCount === 0);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Daily Activity Compliance
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
          <CardContent className="space-y-4">
            {/* Milking Progress */}
            {lactatingAnimalsCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Milk className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">Milking Progress</span>
                  </div>
                  <span className={`text-sm font-semibold ${getMilkingStatusColor()}`}>
                    {completedMilkingSessions.total}/{expectedMilkingSessions} sessions
                  </span>
                </div>
                
                <div className="relative">
                  <Progress 
                    value={milkingCompliancePercent} 
                    className="h-2"
                  />
                  <div 
                    className={`absolute inset-0 h-2 rounded-full ${getMilkingProgressColor()}`}
                    style={{ width: `${milkingCompliancePercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>AM: {completedMilkingSessions.AM}/{lactatingAnimalsCount}</span>
                  <span>PM: {completedMilkingSessions.PM}/{lactatingAnimalsCount}</span>
                </div>

                {animalsMissingMilking.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                          Missing {isAfternoon ? 'PM' : 'AM'} Session
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                          {animalsMissingMilking.slice(0, 3).map(a => a.animalName || a.earTag || 'Unknown').join(', ')}
                          {animalsMissingMilking.length > 3 && ` +${animalsMissingMilking.length - 3} more`}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="shrink-0 h-7 text-xs"
                        onClick={handleRecordMilk}
                      >
                        Record
                      </Button>
                    </div>
                  </div>
                )}

                {milkingCompliancePercent === 100 && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>All milking sessions completed!</span>
                  </div>
                )}
              </div>
            )}

            {/* Feeding Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Wheat className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium">Feeding Status</span>
                </div>
                <span className={`text-sm font-semibold ${hasFeedingToday ? 'text-green-600' : 'text-amber-600'}`}>
                  {completedFeedingSessions} records today
                </span>
              </div>

              {!hasFeedingToday ? (
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs text-amber-800 dark:text-amber-200">
                        No feeding recorded yet today
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="shrink-0 h-7 text-xs"
                      onClick={handleRecordFeed}
                    >
                      Record
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Feeding activity recorded</span>
                </div>
              )}
            </div>

            {/* Team Activity Summary */}
            {farmhandActivity.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium">Team Activity Today</span>
                </div>

                <div className="space-y-1.5">
                  {activeFarmhands.slice(0, 3).map(farmhand => (
                    <div key={farmhand.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[150px]">{farmhand.userName}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{farmhand.activitiesCount}</span>
                        <span>activities</span>
                        {farmhand.lastActivityAt && (
                          <>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(farmhand.lastActivityAt), { addSuffix: true })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {inactiveFarmhands.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 pt-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{inactiveFarmhands.length} team member{inactiveFarmhands.length > 1 ? 's' : ''} with no activity</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <RecordBulkFeedDialog
        open={isRecordFeedOpen}
        onOpenChange={setIsRecordFeedOpen}
        farmId={farmId}
      />

      <RecordBulkMilkDialog
        open={isRecordMilkOpen}
        onOpenChange={setIsRecordMilkOpen}
        farmId={farmId}
      />
    </Card>
  );
}

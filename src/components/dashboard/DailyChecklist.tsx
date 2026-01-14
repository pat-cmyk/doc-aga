import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ListChecks, 
  ChevronDown, 
  ChevronUp,
  Sun,
  Moon,
  Clock,
  Milk,
  Wheat,
  Heart,
  Stethoscope,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { useDailyChecklist, ChecklistItem } from '@/hooks/useDailyChecklist';

interface DailyChecklistProps {
  farmId: string;
}

const iconMap = {
  milk: Milk,
  wheat: Wheat,
  heart: Heart,
  stethoscope: Stethoscope,
};

function ChecklistItemRow({ 
  item, 
  onToggle,
  disabled 
}: { 
  item: ChecklistItem; 
  onToggle: (itemId: string, completed: boolean) => void;
  disabled: boolean;
}) {
  const Icon = iconMap[item.icon];
  const isAutoCompleted = item.autoCompleted;

  return (
    <div 
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        item.completed 
          ? 'bg-green-50 dark:bg-green-950/30' 
          : 'hover:bg-muted/50'
      }`}
    >
      <Checkbox
        id={item.id}
        checked={item.completed}
        onCheckedChange={(checked) => onToggle(item.id, checked as boolean)}
        disabled={disabled || isAutoCompleted}
        className="h-5 w-5"
      />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`p-1 rounded-full ${
          item.completed 
            ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
            : 'bg-muted text-muted-foreground'
        }`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <label
          htmlFor={item.id}
          className={`text-sm cursor-pointer ${
            item.completed ? 'text-green-700 dark:text-green-300 line-through' : ''
          }`}
        >
          {item.label}
          {!item.required && <span className="text-xs text-muted-foreground ml-1">(optional)</span>}
        </label>
      </div>
      {item.completed && item.completedAt && (
        <span className="text-xs text-muted-foreground">
          {item.completedAt}
        </span>
      )}
      {isAutoCompleted && item.completed && (
        <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
          Auto
        </Badge>
      )}
    </div>
  );
}

export function DailyChecklist({ farmId }: DailyChecklistProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { checklist, isLoading, toggleItem } = useDailyChecklist(farmId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return null;
  }

  const morningItems = checklist.items.filter(i => i.timeCategory === 'morning');
  const afternoonItems = checklist.items.filter(i => i.timeCategory === 'afternoon');
  const anytimeItems = checklist.items.filter(i => i.timeCategory === 'anytime');

  const isAfternoon = new Date().getHours() >= 12;
  const completedMorning = morningItems.filter(i => i.completed).length;
  const completedAfternoon = afternoonItems.filter(i => i.completed).length;
  const completedAnytime = anytimeItems.filter(i => i.completed).length;

  const handleToggle = (itemId: string, completed: boolean) => {
    toggleItem.mutate({ itemId, completed });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Daily Farm Checklist
                <Badge variant="outline" className="ml-1 text-xs">
                  {format(new Date(), 'EEE, MMM d')}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {checklist.allRequiredComplete && (
                  <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Today's Progress</span>
                <span className="font-medium">{checklist.completionPercent}%</span>
              </div>
              <Progress value={checklist.completionPercent} className="h-2" />
            </div>

            {/* Morning Tasks */}
            {morningItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Morning Tasks</span>
                  <Badge variant="secondary" className="text-xs">
                    {completedMorning}/{morningItems.length}
                  </Badge>
                </div>
                <div className="space-y-1 ml-6">
                  {morningItems.map(item => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      disabled={toggleItem.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Afternoon Tasks */}
            {afternoonItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  <span>Afternoon/Evening Tasks</span>
                  <Badge variant="secondary" className="text-xs">
                    {completedAfternoon}/{afternoonItems.length}
                  </Badge>
                </div>
                <div className={`space-y-1 ml-6 ${!isAfternoon ? 'opacity-60' : ''}`}>
                  {afternoonItems.map(item => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      disabled={toggleItem.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Anytime Tasks */}
            {anytimeItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>Anytime Tasks</span>
                  <Badge variant="secondary" className="text-xs">
                    {completedAnytime}/{anytimeItems.length}
                  </Badge>
                </div>
                <div className="space-y-1 ml-6">
                  {anytimeItems.map(item => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      disabled={toggleItem.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

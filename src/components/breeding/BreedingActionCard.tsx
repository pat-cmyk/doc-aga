/**
 * BreedingActionCard - Action item card for Breeding Hub
 * 
 * Shows an animal that needs attention with quick action buttons.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, Stethoscope, Heart } from 'lucide-react';
import type { BreedingAction } from '@/hooks/useBreedingHub';

interface BreedingActionCardProps {
  action: BreedingAction;
  onViewAnimal?: (animalId: string) => void;
  onScheduleAI?: (animalId: string) => void;
  onRecordHeat?: (animalId: string) => void;
  onConfirmPregnancy?: (animalId: string) => void;
}

const URGENCY_STYLES = {
  now: 'border-l-4 border-l-destructive bg-destructive/5',
  today: 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
  soon: 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
  upcoming: 'border-l-4 border-l-muted-foreground/30',
};

const URGENCY_BADGE_VARIANT: Record<string, 'destructive' | 'outline' | 'secondary'> = {
  now: 'destructive',
  today: 'secondary',
  soon: 'outline',
  upcoming: 'outline',
};

export function BreedingActionCard({
  action,
  onViewAnimal,
  onScheduleAI,
  onRecordHeat,
  onConfirmPregnancy,
}: BreedingActionCardProps) {
  const animalDisplay = action.animal.name || action.animal.ear_tag || 'Unknown';

  const getIcon = () => {
    switch (action.type) {
      case 'in_heat':
        return <Heart className="h-4 w-4 text-orange-500" />;
      case 'preg_check_due':
        return <Stethoscope className="h-4 w-4 text-purple-500" />;
      case 'expected_heat':
        return <Clock className="h-4 w-4 text-green-500" />;
      case 'expected_delivery':
        return <Calendar className="h-4 w-4 text-pink-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPrimaryAction = () => {
    switch (action.type) {
      case 'in_heat':
        return onScheduleAI ? (
          <Button size="sm" onClick={() => onScheduleAI(action.animal.id)}>
            Schedule AI
          </Button>
        ) : null;
      case 'preg_check_due':
        return onConfirmPregnancy ? (
          <Button size="sm" variant="secondary" onClick={() => onConfirmPregnancy(action.animal.id)}>
            Confirm Preg
          </Button>
        ) : null;
      case 'expected_heat':
        return onRecordHeat ? (
          <Button size="sm" variant="outline" onClick={() => onRecordHeat(action.animal.id)}>
            Record Heat
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all hover:shadow-sm',
        URGENCY_STYLES[action.urgency]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => onViewAnimal?.(action.animal.id)}
              className="font-medium hover:underline truncate block text-left"
            >
              {animalDisplay}
            </button>
            <p className="text-xs text-muted-foreground">
              {action.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {action.hoursRemaining !== undefined && (
            <Badge variant={URGENCY_BADGE_VARIANT[action.urgency]} className="text-xs">
              {action.hoursRemaining}h left
            </Badge>
          )}
          {action.daysRemaining !== undefined && action.daysRemaining > 0 && (
            <Badge variant="outline" className="text-xs">
              {action.daysRemaining}d
            </Badge>
          )}
          {getPrimaryAction()}
        </div>
      </div>
    </div>
  );
}

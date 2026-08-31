/**
 * BreedingStatusAnimalList - Drill-down dialog showing animals in a specific breeding status.
 * Clicking an animal navigates to their profile page.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BreedingAnimal } from '@/hooks/useBreedingHub';

interface BreedingStatusAnimalListProps {
  open: boolean;
  onClose: () => void;
  statusLabel: string;
  statusIcon: string;
  animals: BreedingAnimal[];
}

export function BreedingStatusAnimalList({
  open,
  onClose,
  statusLabel,
  statusIcon,
  animals,
}: BreedingStatusAnimalListProps) {
  const navigate = useNavigate();

  const handleSelect = (animalId: string) => {
    onClose();
    navigate(`/animals/${animalId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{statusIcon}</span>
            {statusLabel}
            <Badge variant="secondary" className="ml-auto">
              {animals.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {animals.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            No animals in this status
          </p>
        ) : (
          <div className="h-[300px] overflow-y-auto pr-2">
            <div className="space-y-1">
              {animals.map((animal) => (
                <button
                  key={animal.id}
                  onClick={() => handleSelect(animal.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {animal.name || 'Unnamed'}
                      {animal.gender?.toLowerCase() !== 'female' && (
                        <span className="ml-1 text-blue-500" title="Lalaki / Male">♂</span>
                      )}
                    </span>
                    {animal.ear_tag && (
                      <span className="text-xs text-muted-foreground truncate">
                        {animal.ear_tag}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {animal.gender?.toLowerCase() !== 'female' ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-blue-600">
                        ♂ Lalaki
                      </Badge>
                    ) : animal.fertility_status && FERTILITY_STATUS_CONFIG[animal.fertility_status] && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {FERTILITY_STATUS_CONFIG[animal.fertility_status].icon} {FERTILITY_STATUS_CONFIG[animal.fertility_status].label}
                      </Badge>
                    )}
                    <DaysOpenBadge animal={animal} />
                    <Badge variant="outline" className="text-xs">
                      {animal.livestock_type}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Days Open badge — shows days since last calving for open_cycling/fresh_postpartum animals.
 * Color-coded: green <100d, yellow 100-150d, red >150d.
 */
function DaysOpenBadge({ animal }: { animal: BreedingAnimal }) {
  if (!animal.last_calving_date) return null;

  const status = animal.fertility_status;
  const showStatuses: (string | null)[] = ['open_cycling', 'fresh_postpartum', 'in_heat', 'bred_waiting'];
  if (!showStatuses.includes(status)) return null;

  const daysOpen = differenceInDays(new Date(), new Date(animal.last_calving_date));
  if (daysOpen <= 0) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 font-mono',
        daysOpen < 100 && 'bg-green-50 text-green-700 border-green-200',
        daysOpen >= 100 && daysOpen < 150 && 'bg-yellow-50 text-yellow-700 border-yellow-200',
        daysOpen >= 150 && 'bg-red-50 text-red-700 border-red-200',
      )}
      title={`${daysOpen} days since last calving (Days Open)`}
    >
      {daysOpen}d open
    </Badge>
  );
}

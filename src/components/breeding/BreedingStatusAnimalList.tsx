/**
 * BreedingStatusAnimalList - Drill-down dialog showing animals in a specific breeding status.
 * Clicking an animal navigates to their profile page.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
    navigate(`/?tab=animals&animalId=${animalId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
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
          <ScrollArea className="max-h-[300px] pr-2">
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
                    </span>
                    {animal.ear_tag && (
                      <span className="text-xs text-muted-foreground truncate">
                        {animal.ear_tag}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {animal.fertility_status && FERTILITY_STATUS_CONFIG[animal.fertility_status] && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {FERTILITY_STATUS_CONFIG[animal.fertility_status].icon} {FERTILITY_STATUS_CONFIG[animal.fertility_status].label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {animal.livestock_type}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * BreedingAnimalSearchDialog - Search animals and view breeding records
 * 
 * Provides a search input to find animals by name/ear tag, then shows
 * a pop-out dialog with their breeding summary and a link to full profile.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FertilityStateBadge } from './FertilityStateBadge';
import type { BreedingAnimal } from '@/hooks/useBreedingHub';

interface BreedingAnimalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animals: BreedingAnimal[];
}

export function BreedingAnimalSearchDialog({
  open,
  onOpenChange,
  animals,
}: BreedingAnimalSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<BreedingAnimal | null>(null);
  const navigate = useNavigate();

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return animals
      .filter(
        (a) =>
          (a.name && a.name.toLowerCase().includes(term)) ||
          (a.ear_tag && a.ear_tag.toLowerCase().includes(term))
      )
      .slice(0, 10);
  }, [searchTerm, animals]);

  // Fetch AI records on-demand for selected animal
  const { data: aiRecords, isLoading: aiLoading } = useQuery({
    queryKey: ['breeding-search-ai', selectedAnimal?.id],
    queryFn: async () => {
      if (!selectedAnimal) return [];
      const { data, error } = await supabase
        .from('ai_records')
        .select('*')
        .eq('animal_id', selectedAnimal.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAnimal,
  });

  const latestAI = aiRecords?.[0] || null;

  const handleSelect = (animal: BreedingAnimal) => {
    setSelectedAnimal(animal);
  };

  const handleGoToProfile = () => {
    if (selectedAnimal) {
      onOpenChange(false);
      setSelectedAnimal(null);
      setSearchTerm('');
      navigate(`/animals?animalId=${selectedAnimal.id}`);
    }
  };

  const handleBack = () => {
    setSelectedAnimal(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedAnimal(null);
    setSearchTerm('');
  };

  const formatDate = (d: string | null) => (d ? format(new Date(d), 'MMM d, yyyy') : '—');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {!selectedAnimal ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Breeding Animals
              </DialogTitle>
              <DialogDescription>
                Search by name or ear tag to view breeding records.
              </DialogDescription>
            </DialogHeader>

            <Input
              placeholder="Type name or ear tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />

            {searchTerm.trim() && (
              <ScrollArea className="h-[300px]">
                {searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((animal) => (
                      <button
                        key={animal.id}
                        onClick={() => handleSelect(animal)}
                        className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-muted text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {animal.name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {animal.ear_tag || 'No tag'}
                          </p>
                        </div>
                        <FertilityStateBadge
                          status={animal.fertility_status}
                          size="sm"
                          showTooltip={false}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No animals found matching "{searchTerm}"
                  </p>
                )}
              </ScrollArea>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground mr-1"
                >
                  ← 
                </button>
                <span className="truncate">{selectedAnimal.name || 'Unnamed'}</span>
                {selectedAnimal.ear_tag && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {selectedAnimal.ear_tag}
                  </Badge>
                )}
                <FertilityStateBadge
                  status={selectedAnimal.fertility_status}
                  size="sm"
                />
              </DialogTitle>
              <DialogDescription>
                Breeding record summary for this animal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Latest AI Record */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Latest AI Record</h4>
                {aiLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : latestAI ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Scheduled</span>
                    <span>{formatDate(latestAI.scheduled_date)}</span>
                    <span className="text-muted-foreground">Performed</span>
                    <span>{formatDate(latestAI.performed_date)}</span>
                    <span className="text-muted-foreground">Semen Code</span>
                    <span>{latestAI.semen_code || '—'}</span>
                    <span className="text-muted-foreground">Pregnancy</span>
                    <span>
                      {latestAI.pregnancy_confirmed === true
                        ? '✅ Confirmed'
                        : latestAI.pregnancy_confirmed === false
                        ? '❌ Not confirmed'
                        : '⏳ Pending'}
                    </span>
                    <span className="text-muted-foreground">Expected Delivery</span>
                    <span>{formatDate(latestAI.expected_delivery_date)}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No AI records found</p>
                )}
              </div>

              <Separator />

              {/* Breeding Info */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Breeding Info</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Last Heat</span>
                  <span>{formatDate(selectedAnimal.last_heat_date)}</span>
                  <span className="text-muted-foreground">Last AI</span>
                  <span>{formatDate(selectedAnimal.last_ai_date)}</span>
                  <span className="text-muted-foreground">Parity</span>
                  <span>{selectedAnimal.parity ?? '—'}</span>
                  <span className="text-muted-foreground">Services This Cycle</span>
                  <span>{selectedAnimal.services_this_cycle ?? '—'}</span>
                  <span className="text-muted-foreground">VWP End Date</span>
                  <span>{formatDate(selectedAnimal.voluntary_waiting_end_date)}</span>
                  <span className="text-muted-foreground">Last Calving</span>
                  <span>{formatDate(selectedAnimal.last_calving_date)}</span>
                </div>
              </div>

              <Separator />

              <Button onClick={handleGoToProfile} className="w-full" variant="default">
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Animal Profile
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

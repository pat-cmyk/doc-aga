/**
 * FarmScheduleAIDialog - Farm-level AI scheduling with animal picker
 * 
 * Two-step dialog: 1) Pick animal, 2) Fill AI scheduling form.
 * Used from BreedingHub where no animal is pre-selected.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  fertility_status: string | null;
}

interface FarmScheduleAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animals: Animal[];
  farmId: string | null;
}

export function FarmScheduleAIDialog({ open, onOpenChange, animals, farmId }: FarmScheduleAIDialogProps) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [scheduledDate, setScheduledDate] = useState('');
  const [technician, setTechnician] = useState('');
  const [semenCode, setSemenCode] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredAnimals = useMemo(() => {
    const q = search.toLowerCase();
    return animals.filter(a =>
      (a.name?.toLowerCase().includes(q) || a.ear_tag?.toLowerCase().includes(q))
    );
  }, [animals, search]);

  const handleSelectAnimal = (animal: Animal) => {
    setSelectedAnimal(animal);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal || !farmId || !scheduledDate) {
      toast({ title: 'Required', description: 'Please select a scheduled date', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: insertedData, error } = await supabase.from('ai_records').insert({
        animal_id: selectedAnimal.id,
        scheduled_date: scheduledDate,
        technician: technician || null,
        semen_code: semenCode || null,
        notes: notes || null,
        created_by: user?.id,
      }).select('id').single();

      if (error) throw error;

      if (insertedData) {
        await insertBreedingEvent({
          animalId: selectedAnimal.id,
          farmId,
          eventType: 'ai_scheduled',
          eventDate: scheduledDate,
          relatedAiRecordId: insertedData.id,
          notes: notes || undefined,
        });
      }

      toast({ title: 'Success!', description: 'AI breeding scheduled successfully' });
      queryClient.invalidateQueries({ queryKey: ['breeding-hub'] });
      handleClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('pick');
      setSelectedAnimal(null);
      setSearch('');
      setScheduledDate('');
      setTechnician('');
      setSemenCode('');
      setNotes('');
    }, 200);
  };

  const statusLabel = (status: string | null) => {
    if (!status) return null;
    const config = FERTILITY_STATUS_CONFIG[status as keyof typeof FERTILITY_STATUS_CONFIG];
    return config ? `${config.icon} ${config.label}` : status;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Schedule AI Breeding
          </DialogTitle>
        </DialogHeader>

        {step === 'pick' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ear tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {filteredAnimals.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No animals found</p>
                )}
                {filteredAnimals.map(animal => (
                  <button
                    key={animal.id}
                    onClick={() => handleSelectAnimal(animal)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{animal.name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{animal.ear_tag || 'No tag'}</p>
                    </div>
                    {animal.fertility_status && (
                      <Badge variant="outline" className="text-xs">
                        {statusLabel(animal.fertility_status)}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected animal header */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep('pick')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedAnimal?.name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground">{selectedAnimal?.ear_tag}</p>
              </div>
              <Button type="button" variant="link" size="sm" className="text-xs" onClick={() => setStep('pick')}>
                Change
              </Button>
            </div>

            <div>
              <Label htmlFor="farm_ai_date">Scheduled Date *</Label>
              <Input
                id="farm_ai_date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="farm_ai_tech">Technician</Label>
              <Input
                id="farm_ai_tech"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Enter technician name"
              />
            </div>
            <div>
              <Label htmlFor="farm_ai_semen">Semen Code</Label>
              <Input
                id="farm_ai_semen"
                value={semenCode}
                onChange={(e) => setSemenCode(e.target.value)}
                placeholder="Enter semen code/batch number"
              />
            </div>
            <div>
              <Label htmlFor="farm_ai_notes">Notes</Label>
              <div className="flex gap-2">
                <Textarea
                  id="farm_ai_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                  className="self-start"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Scheduling...' : 'Schedule'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

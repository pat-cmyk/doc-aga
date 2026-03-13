/**
 * FarmRecordHeatDialog - Farm-level heat recording with animal picker
 * 
 * Two-step dialog: 1) Pick animal, 2) Record heat details.
 * Used from BreedingHub where no animal is pre-selected.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Flame, ArrowLeft, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useHeatRecords } from '@/hooks/useHeatRecords';
import { DETECTION_METHODS, HEAT_INTENSITY } from '@/lib/bcsDefinitions';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useQueryClient } from '@tanstack/react-query';
import { FERTILITY_STATUS_CONFIG } from '@/types/fertility';

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  fertility_status: string | null;
}

interface FarmRecordHeatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animals: Animal[];
  farmId: string | null;
}

export function FarmRecordHeatDialog({ open, onOpenChange, animals, farmId }: FarmRecordHeatDialogProps) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [detectedAt, setDetectedAt] = useState<Date>(new Date());
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [detectionMethod, setDetectionMethod] = useState('visual');
  const [intensity, setIntensity] = useState('normal');
  const [standingHeat, setStandingHeat] = useState(false);
  const [notes, setNotes] = useState('');
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const { createHeatRecord } = useHeatRecords(selectedAnimal?.id || '');

  const filteredAnimals = useMemo(() => {
    const q = search.toLowerCase();
    return animals.filter(a => {
      const matchesSearch = a.name?.toLowerCase().includes(q) || a.ear_tag?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      // Exclude animals marked as not eligible for breeding
      if (a.fertility_status === 'not_eligible') return false;
      return true;
    });
  }, [animals, search]);

  const handleSelectAnimal = (animal: Animal) => {
    setSelectedAnimal(animal);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!selectedAnimal || !farmId) return;

    await createHeatRecord.mutateAsync({
      animal_id: selectedAnimal.id,
      farm_id: farmId,
      detected_at: detectedAt.toISOString(),
      detection_method: detectionMethod,
      intensity,
      standing_heat: standingHeat,
      notes: notes || undefined,
    });

    await insertBreedingEvent({
      animalId: selectedAnimal.id,
      farmId,
      eventType: 'heat_detected',
      eventDate: detectedAt.toISOString(),
      notes: notes || undefined,
      metadata: { detection_method: detectionMethod, intensity, standing_heat: standingHeat },
    });

    queryClient.invalidateQueries({ queryKey: ['breeding-hub'] });
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setStep('pick');
      setSelectedAnimal(null);
      setSearch('');
      setDetectedAt(new Date());
      setDetectionMethod('visual');
      setIntensity('normal');
      setStandingHeat(false);
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
      <DialogContent className="max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Record Heat Detection
          </DialogTitle>
        </DialogHeader>

        {step === 'pick' ? (
          <div className="flex-1 overflow-y-auto space-y-3">
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
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Selected animal header */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep('pick')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedAnimal?.name || 'Unnamed'}</p>
                <p className="text-xs text-muted-foreground">{selectedAnimal?.ear_tag}</p>
              </div>
              <Button variant="link" size="sm" className="text-xs" onClick={() => setStep('pick')}>
                Change
              </Button>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>When Detected</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(detectedAt, 'PPP p')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={detectedAt}
                    onSelect={(date) => { if (date) { setDetectedAt(date); setDatePopoverOpen(false); } }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Detection Method */}
            <div className="space-y-2">
              <Label>Detection Method</Label>
              <Select value={detectionMethod} onValueChange={setDetectionMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DETECTION_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label} ({m.labelTagalog})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intensity */}
            <div className="space-y-2">
              <Label>Intensity</Label>
              <Select value={intensity} onValueChange={setIntensity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEAT_INTENSITY.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label} ({l.labelTagalog})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Standing Heat */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="font-medium">Standing Heat</Label>
                <p className="text-sm text-muted-foreground">Animal stands still when mounted</p>
              </div>
              <Switch checked={standingHeat} onCheckedChange={setStandingHeat} />
            </div>

            {standingHeat && (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-3 text-sm">
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  Optimal breeding window: 12-30 hours from now
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Additional observations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                  className="self-start"
                />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={createHeatRecord.isPending} className="w-full">
              {createHeatRecord.isPending ? 'Saving...' : 'Save Heat Record'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

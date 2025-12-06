import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Flame } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useHeatRecords } from '@/hooks/useHeatRecords';
import { DETECTION_METHODS, HEAT_INTENSITY } from '@/lib/bcsDefinitions';

interface RecordHeatDialogProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  trigger?: React.ReactNode;
}

export function RecordHeatDialog({ animalId, farmId, animalName, trigger }: RecordHeatDialogProps) {
  const [open, setOpen] = useState(false);
  const [detectedAt, setDetectedAt] = useState<Date>(new Date());
  const [detectionMethod, setDetectionMethod] = useState('visual');
  const [intensity, setIntensity] = useState('normal');
  const [standingHeat, setStandingHeat] = useState(false);
  const [notes, setNotes] = useState('');

  const { createHeatRecord } = useHeatRecords(animalId);

  const handleSubmit = async () => {
    await createHeatRecord.mutateAsync({
      animal_id: animalId,
      farm_id: farmId,
      detected_at: detectedAt.toISOString(),
      detection_method: detectionMethod,
      intensity,
      standing_heat: standingHeat,
      notes: notes || undefined,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setDetectedAt(new Date());
    setDetectionMethod('visual');
    setIntensity('normal');
    setStandingHeat(false);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Record Heat
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Record Heat Detection
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date/Time */}
          <div className="space-y-2">
            <Label>When Detected</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(detectedAt, 'PPP p')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={detectedAt}
                  onSelect={(date) => date && setDetectedAt(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Detection Method */}
          <div className="space-y-2">
            <Label>Detection Method</Label>
            <Select value={detectionMethod} onValueChange={setDetectionMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DETECTION_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label} ({method.labelTagalog})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Intensity */}
          <div className="space-y-2">
            <Label>Intensity</Label>
            <Select value={intensity} onValueChange={setIntensity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEAT_INTENSITY.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label} ({level.labelTagalog})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Standing Heat Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="font-medium">Standing Heat</Label>
              <p className="text-sm text-muted-foreground">
                Animal stands still when mounted
              </p>
            </div>
            <Switch checked={standingHeat} onCheckedChange={setStandingHeat} />
          </div>

          {standingHeat && (
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-3 text-sm">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                Optimal breeding window: 12-30 hours from now
              </p>
              <p className="text-muted-foreground mt-1">
                Best time for AI/breeding will be calculated automatically.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={createHeatRecord.isPending}
            className="w-full"
          >
            {createHeatRecord.isPending ? 'Saving...' : 'Save Heat Record'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

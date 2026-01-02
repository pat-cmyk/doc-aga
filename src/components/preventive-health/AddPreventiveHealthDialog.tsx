import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Syringe, Bug } from 'lucide-react';
import { usePreventiveHealthProtocols, useAddPreventiveHealthSchedule } from '@/hooks/usePreventiveHealth';
import { format, addMonths } from 'date-fns';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface AddPreventiveHealthDialogProps {
  animalId: string;
  farmId: string;
  livestockType: string;
  trigger?: React.ReactNode;
}

export function AddPreventiveHealthDialog({
  animalId,
  farmId,
  livestockType,
  trigger,
}: AddPreventiveHealthDialogProps) {
  const [open, setOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<'vaccination' | 'deworming'>('vaccination');
  const [treatmentName, setTreatmentName] = useState('');
  const [customTreatment, setCustomTreatment] = useState('');
  const [scheduledDate, setScheduledDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const isOnline = useOnlineStatus();

  const { data: protocols = [] } = usePreventiveHealthProtocols(livestockType);
  const addSchedule = useAddPreventiveHealthSchedule();

  const filteredProtocols = useMemo(() => {
    return protocols.filter((p) => p.treatment_type === scheduleType);
  }, [protocols, scheduleType]);

  const selectedProtocol = useMemo(() => {
    return protocols.find((p) => p.treatment_name === treatmentName);
  }, [protocols, treatmentName]);

  const nextDueDate = useMemo(() => {
    if (!selectedProtocol?.recurring_interval_months || !scheduledDate) return null;
    return format(
      addMonths(new Date(scheduledDate), selectedProtocol.recurring_interval_months),
      'MMM d, yyyy'
    );
  }, [selectedProtocol, scheduledDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalTreatmentName = treatmentName === 'custom' ? customTreatment : treatmentName;
    if (!finalTreatmentName) return;

    await addSchedule.mutateAsync({
      animal_id: animalId,
      farm_id: farmId,
      schedule_type: scheduleType,
      treatment_name: finalTreatmentName,
      scheduled_date: scheduledDate,
      recurring_interval_months: selectedProtocol?.recurring_interval_months || null,
      notes: notes || null,
    });

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setScheduleType('vaccination');
    setTreatmentName('');
    setCustomTreatment('');
    setScheduledDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Preventive Health Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scheduleType === 'vaccination' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setScheduleType('vaccination');
                  setTreatmentName('');
                }}
              >
                <Syringe className="h-4 w-4 mr-2" />
                Vaccination
              </Button>
              <Button
                type="button"
                variant={scheduleType === 'deworming' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => {
                  setScheduleType('deworming');
                  setTreatmentName('');
                }}
              >
                <Bug className="h-4 w-4 mr-2" />
                Deworming
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Treatment</Label>
            <Select value={treatmentName} onValueChange={setTreatmentName}>
              <SelectTrigger>
                <SelectValue placeholder="Select treatment..." />
              </SelectTrigger>
              <SelectContent>
                {filteredProtocols.map((protocol) => (
                  <SelectItem key={protocol.id} value={protocol.treatment_name}>
                    <div className="flex flex-col">
                      <span>{protocol.treatment_name}</span>
                      {protocol.treatment_name_tagalog && (
                        <span className="text-xs text-muted-foreground">
                          {protocol.treatment_name_tagalog}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">Other (Custom)</SelectItem>
              </SelectContent>
            </Select>

            {treatmentName === 'custom' && (
              <Input
                placeholder="Enter treatment name..."
                value={customTreatment}
                onChange={(e) => setCustomTreatment(e.target.value)}
                className="mt-2"
              />
            )}

            {selectedProtocol && (
              <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
                {selectedProtocol.notes}
                {selectedProtocol.is_mandatory && (
                  <span className="ml-1 text-primary font-medium">(Mandatory)</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
            {nextDueDate && (
              <p className="text-xs text-muted-foreground">
                Next due: {nextDueDate} (every {selectedProtocol?.recurring_interval_months} months)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <div className="flex gap-2">
              <Textarea
                placeholder="Add any notes..."
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addSchedule.isPending || (!treatmentName || (treatmentName === 'custom' && !customTreatment))}
            >
              {addSchedule.isPending ? 'Adding...' : 'Add Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

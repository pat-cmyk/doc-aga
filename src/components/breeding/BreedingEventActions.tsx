/**
 * BreedingEventActions - Quick action buttons for breeding lifecycle transitions
 * 
 * Provides UI for GAPs 3, 4, 5:
 * - Non-return check (suspected pregnant)
 * - Heat return / pregnancy failed
 * - VWP ended (postpartum → open cycling)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Heart, Loader2, Search } from 'lucide-react';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { useToast } from '@/hooks/use-toast';
import type { BreedingEventType } from '@/types/fertility';

interface BreedingEventActionProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  onSuccess?: () => void;
}

/**
 * Mark Non-Return (GAP 3)
 * Used when animal hasn't returned to heat by Day 18-24 after AI
 */
export function MarkNonReturnButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <BreedingEventActionDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      eventType="non_return"
      title="Mark as Suspected Pregnant"
      description="No heat return detected within 18-24 days after AI. This marks the animal as suspected pregnant pending confirmation."
      icon={<Search className="h-5 w-5 text-purple-500" />}
      buttonLabel="Suspected Pregnant"
      buttonVariant="outline"
      confirmLabel="Confirm Non-Return"
      successMessage="Marked as suspected pregnant. Schedule pregnancy check."
      onSuccess={onSuccess}
    />
  );
}

/**
 * Record Heat Return / Pregnancy Failed (GAP 4)
 * Used when a bred animal returns to heat (breeding failed)
 */
export function RecordHeatReturnButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <BreedingEventActionDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      eventType="heat_return"
      title="Record Heat Return"
      description="The animal has returned to heat, indicating the previous breeding was unsuccessful. Status will reset to Open & Cycling."
      icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
      buttonLabel="Heat Returned"
      buttonVariant="outline"
      confirmLabel="Confirm Heat Return"
      successMessage="Recorded heat return. Animal is back to cycling."
      onSuccess={onSuccess}
    />
  );
}

/**
 * Mark VWP Ended (GAP 5)
 * Used when postpartum voluntary waiting period is complete
 */
export function MarkVWPEndedButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <BreedingEventActionDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      eventType="vwp_ended"
      title="Complete Voluntary Waiting Period"
      description="The postpartum recovery period is complete. The animal will move to Open & Cycling status, eligible for breeding."
      icon={<Heart className="h-5 w-5 text-green-500" />}
      buttonLabel="VWP Complete"
      buttonVariant="outline"
      confirmLabel="Confirm VWP Complete"
      successMessage="VWP complete. Animal is now eligible for breeding."
      onSuccess={onSuccess}
    />
  );
}

// Generic reusable dialog for breeding event actions
interface BreedingEventActionDialogProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  eventType: BreedingEventType;
  title: string;
  description: string;
  icon: React.ReactNode;
  buttonLabel: string;
  buttonVariant?: 'default' | 'outline' | 'destructive';
  confirmLabel: string;
  successMessage: string;
  onSuccess?: () => void;
}

function BreedingEventActionDialog({
  animalId,
  farmId,
  animalName,
  eventType,
  title,
  description,
  icon,
  buttonLabel,
  buttonVariant = 'outline',
  confirmLabel,
  successMessage,
  onSuccess,
}: BreedingEventActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await insertBreedingEvent({
        animalId,
        farmId,
        eventType,
        eventDate: new Date().toISOString(),
        notes: notes || undefined,
      });

      toast({ title: "Success", description: successMessage });
      setOpen(false);
      setNotes('');
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size="sm" className="gap-2">
          {icon}
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional observations..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Saving...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

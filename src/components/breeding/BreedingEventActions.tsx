/**
 * BreedingEventActions - Quick action buttons for breeding lifecycle transitions
 * 
 * Provides UI for all breeding milestones:
 * - Record Heat (wraps RecordHeatDialog)
 * - Schedule AI (wraps ScheduleAIDialog)
 * - Non-return check (suspected pregnant)
 * - Confirm Pregnancy
 * - Pregnancy Failed
 * - Heat return / breeding failed
 * - VWP ended (postpartum → open cycling)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Heart, Loader2, Search, XCircle, Flame, Syringe, Info } from 'lucide-react';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { useToast } from '@/hooks/use-toast';
import { showErrorToastLegacy } from '@/lib/errorHandling';
import { RecordHeatDialog } from '@/components/heat-detection/RecordHeatDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToQueue } from '@/lib/offlineQueue';
import { playSound } from '@/lib/audioFeedback';
import { hapticNotification } from '@/lib/haptics';
import { ScheduleAIDialog } from '@/components/ScheduleAIDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { BreedingEventType } from '@/types/fertility';
import { differenceInDays } from 'date-fns';

interface BreedingEventActionProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  lastAIDate?: string;
  onSuccess?: () => void;
}

/**
 * Record Heat Button - wraps the full RecordHeatDialog
 */
export function RecordHeatButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <RecordHeatDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      trigger={
        <Button variant="outline" size="sm" className="gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Record Heat
        </Button>
      }
    />
  );
}

/**
 * Schedule AI Button - wraps the existing ScheduleAIDialog
 */
export function ScheduleAIButton({ animalId, farmId, onSuccess }: BreedingEventActionProps) {
  return (
    <ScheduleAIDialog
      animalId={animalId}
      farmId={farmId}
      onSuccess={onSuccess}
    />
  );
}

/**
 * Mark Non-Return (GAP 3)
 */
export function MarkNonReturnButton({ animalId, farmId, animalName, lastAIDate, onSuccess }: BreedingEventActionProps) {
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
      lastAIDate={lastAIDate}
      onSuccess={onSuccess}
    />
  );
}

/**
 * Confirm Pregnancy Button - inserts pregnancy_confirmed event directly
 */
export function ConfirmPregnancyButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <BreedingEventActionDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      eventType="pregnancy_confirmed"
      title="Confirm Pregnancy"
      description="Pregnancy has been confirmed via rectal palpation, ultrasound, or other method."
      icon={<CheckCircle className="h-5 w-5 text-pink-500" />}
      buttonLabel="Confirm Pregnancy"
      buttonVariant="outline"
      confirmLabel="Confirm"
      successMessage="Pregnancy confirmed! Monitor for expected calving date."
      onSuccess={onSuccess}
    />
  );
}

/**
 * Pregnancy Failed Button - records pregnancy_failed event
 */
export function PregnancyFailedButton({ animalId, farmId, animalName, onSuccess }: BreedingEventActionProps) {
  return (
    <BreedingEventActionDialog
      animalId={animalId}
      farmId={farmId}
      animalName={animalName}
      eventType="pregnancy_failed"
      title="Record Pregnancy Failed"
      description="Pregnancy check was negative or pregnancy was lost. Animal will return to Open & Cycling status."
      icon={<XCircle className="h-5 w-5 text-red-500" />}
      buttonLabel="Pregnancy Failed"
      buttonVariant="outline"
      confirmLabel="Confirm Failed"
      successMessage="Pregnancy failure recorded. Animal is back to cycling."
      onSuccess={onSuccess}
    />
  );
}

/**
 * Record Heat Return / Pregnancy Failed (GAP 4)
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
  lastAIDate?: string;
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
  lastAIDate,
  onSuccess,
}: BreedingEventActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // Timing guard for non-return: require 18+ days post-AI
  const nonReturnTooEarly = eventType === 'non_return' && lastAIDate
    ? differenceInDays(new Date(), new Date(lastAIDate)) < 18
    : false;
  const daysSinceAI = lastAIDate ? differenceInDays(new Date(), new Date(lastAIDate)) : null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (!isOnline) {
        // Offline: queue for later sync
        await addToQueue({
          id: crypto.randomUUID(),
          type: 'breeding_event',
          payload: {
            breedingEvent: {
              animalId,
              farmId,
              eventType,
              eventDate: new Date().toISOString(),
              notes: notes || undefined,
            },
          },
          createdAt: Date.now(),
        });

        playSound('success');
        hapticNotification('success');
        toast({ title: "Queued (Offline)", description: `${successMessage} — will sync when online` });
      } else {
        await insertBreedingEvent({
          animalId,
          farmId,
          eventType,
          eventDate: new Date().toISOString(),
          notes: notes || undefined,
        });

        playSound('success');
        hapticNotification('success');
        toast({ title: "Success", description: successMessage });
      }

      setOpen(false);
      setNotes('');
      onSuccess?.();
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "recording breeding event");
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
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Non-return timing guard */}
          {nonReturnTooEarly && daysSinceAI !== null && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Maghintay ng 18-24 araw matapos ang AI</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wait 18-24 days post-AI before marking non-return. Currently {daysSinceAI} day{daysSinceAI !== 1 ? 's' : ''} since AI.
                </p>
              </AlertDescription>
            </Alert>
          )}

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
            <Button onClick={handleConfirm} disabled={loading || nonReturnTooEarly}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Saving...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

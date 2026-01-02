import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarIcon, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EXIT_REASONS, EXIT_DETAILS } from '@/lib/bcsDefinitions';
import { useAddRevenue } from '@/hooks/useRevenues';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface RecordAnimalExitDialogProps {
  animalId: string;
  animalName?: string;
  farmId: string;
  livestockType?: string;
  earTag?: string;
  onExitRecorded?: () => void;
  trigger?: React.ReactNode;
}

// Valid sources per farm_revenues_source_check constraint:
// 'Milk Sales', 'Livestock Sales', 'Byproduct', 'Other'
const getSaleSource = (): string => 'Livestock Sales';

export function RecordAnimalExitDialog({
  animalId,
  animalName,
  farmId,
  livestockType,
  earTag,
  onExitRecorded,
  trigger,
}: RecordAnimalExitDialogProps) {
  const { toast } = useToast();
  const addRevenue = useAddRevenue();
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [exitDate, setExitDate] = useState<Date>(new Date());
  const [exitDatePopoverOpen, setExitDatePopoverOpen] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [exitReasonDetails, setExitReasonDetails] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [buyerInfo, setBuyerInfo] = useState('');
  const [exitNotes, setExitNotes] = useState('');

  const detailOptions = EXIT_DETAILS[exitReason] || [];

  const handleSubmit = () => {
    if (!exitReason) {
      toast({
        title: 'Required Field',
        description: 'Please select an exit reason.',
        variant: 'destructive',
      });
      return;
    }
    setConfirmOpen(true);
  };

  const confirmExit = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('animals')
        .update({
          exit_date: format(exitDate, 'yyyy-MM-dd'),
          exit_reason: exitReason,
          exit_reason_details: exitReasonDetails || null,
          sale_price: salePrice ? parseFloat(salePrice) : null,
          buyer_info: buyerInfo || null,
          exit_notes: exitNotes || null,
          is_deleted: true,
        })
        .eq('id', animalId);

      if (error) throw error;

      // Auto-create revenue record if animal was sold with a price
      if (exitReason === 'sold' && salePrice && parseFloat(salePrice) > 0) {
        const animalIdentifier = animalName || earTag || 'Animal';
        const detailLabel = exitReasonDetails ? ` - ${exitReasonDetails.replace(/_/g, ' ')}` : '';
        
        await addRevenue.mutateAsync({
          farm_id: farmId,
          amount: parseFloat(salePrice),
          source: getSaleSource(),
          transaction_date: format(exitDate, 'yyyy-MM-dd'),
          linked_animal_id: animalId,
          notes: `Sale of ${animalIdentifier}${earTag && animalName ? ` (${earTag})` : ''}${detailLabel}`,
        });
      }

      toast({
        title: 'Exit Recorded',
        description: `${animalName || 'Animal'} has been marked as exited.${exitReason === 'sold' && salePrice ? ' Revenue record created.' : ''}`,
      });

      setOpen(false);
      setConfirmOpen(false);
      onExitRecorded?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonLabel = (value: string) =>
    EXIT_REASONS.find((r) => r.value === value);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              Record Exit
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Record Animal Exit
              {animalName && <span className="text-muted-foreground">- {animalName}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Exit Date */}
            <div className="space-y-2">
              <Label>Exit Date</Label>
              <Popover open={exitDatePopoverOpen} onOpenChange={setExitDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(exitDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={exitDate}
                    onSelect={(date) => {
                      if (date) {
                        setExitDate(date);
                        setExitDatePopoverOpen(false);
                      }
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Exit Reason */}
            <div className="space-y-2">
              <Label>Exit Reason *</Label>
              <Select value={exitReason} onValueChange={(val) => {
                setExitReason(val);
                setExitReasonDetails('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label} ({reason.labelTagalog})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exit Reason Details */}
            {detailOptions.length > 0 && (
              <div className="space-y-2">
                <Label>Details</Label>
                <Select value={exitReasonDetails} onValueChange={setExitReasonDetails}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select details..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detailOptions.map((detail) => (
                      <SelectItem key={detail.value} value={detail.value}>
                        {detail.label} ({detail.labelTagalog})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sale Price (for sold) */}
            {exitReason === 'sold' && (
              <>
                <div className="space-y-2">
                  <Label>Sale Price (PHP)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 50000"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buyer Information</Label>
                  <Input
                    placeholder="Buyer name or contact..."
                    value={buyerInfo}
                    onChange={(e) => setBuyerInfo(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Additional details about the exit..."
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setExitNotes(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                  className="self-start"
                />
              </div>
            </div>

            <Button onClick={handleSubmit} variant="destructive" className="w-full">
              Record Exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Animal Exit</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to record {animalName || 'this animal'} as{' '}
              <strong>{getReasonLabel(exitReason)?.label?.toLowerCase()}</strong>.
              This will mark the animal as inactive in your records.
              <br /><br />
              This action can be reversed by an administrator if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Exit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

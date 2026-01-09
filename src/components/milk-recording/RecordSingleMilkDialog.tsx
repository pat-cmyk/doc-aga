import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Milk, CalendarIcon, Sun, Moon, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { VoiceFormInput } from "@/components/ui/VoiceFormInput";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { addLocalMilkRecord, addLocalMilkInventoryRecord } from "@/lib/dataCache";
import { validateRecordDate } from "@/lib/recordValidation";
import { ExtractedMilkData } from "@/lib/voiceFormExtractors";

interface RecordSingleMilkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  animalName: string | null;
  earTag: string | null;
  farmId: string;
  farmEntryDate?: string | null;
}

export function RecordSingleMilkDialog({
  open,
  onOpenChange,
  animalId,
  animalName,
  earTag,
  farmId,
  farmEntryDate,
}: RecordSingleMilkDialogProps) {
  const [liters, setLiters] = useState("");
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [session, setSession] = useState<'AM' | 'PM'>(
    new Date().getHours() < 12 ? 'AM' : 'PM'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Haptic on dialog open
  useEffect(() => {
    if (open) {
      hapticImpact('light');
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setLiters("");
      setRecordDate(new Date());
      setSession(new Date().getHours() < 12 ? 'AM' : 'PM');
    }
  }, [open]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleSessionChange = (value: string) => {
    hapticSelection();
    setSession(value as 'AM' | 'PM');
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleVoiceDataExtracted = (data: ExtractedMilkData) => {
    if (data.totalLiters) {
      setLiters(data.totalLiters.toString());
    }
    if (data.session) {
      setSession(data.session);
    }
  };

  const handleSubmit = async () => {
    if (!farmId || !animalId) return;

    const litersNum = parseFloat(liters);
    if (isNaN(litersNum) || litersNum <= 0) {
      toast({
        title: "Invalid Liters",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Validate record date against farm entry date
    const dateStr = format(recordDate, "yyyy-MM-dd");
    const validation = validateRecordDate(dateStr, { farm_entry_date: farmEntryDate });
    if (!validation.valid) {
      toast({ 
        title: "Invalid Date", 
        description: validation.message, 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();

    try {
      // STEP 1: Update local dashboard cache IMMEDIATELY
      await addLocalMilkRecord(farmId, dateStr, litersNum);

      // STEP 2: Update local milk inventory cache
      const clientId = `${optimisticId}_milk_0`;
      await addLocalMilkInventoryRecord(farmId, {
        id: `optimistic-${clientId}`,
        milking_record_id: clientId,
        animal_id: animalId,
        animal_name: animalName || 'Unknown',
        ear_tag: earTag,
        record_date: dateStr,
        liters_original: litersNum,
        liters_remaining: litersNum,
        is_available: true,
        created_at: new Date().toISOString(),
        syncStatus: 'pending',
      });

      // Optimistic update for React Query
      const optimisticRecord = {
        id: `optimistic-${optimisticId}`,
        animal_id: animalId,
        record_date: dateStr,
        liters: litersNum,
        session: session,
        is_sold: false,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      };

      queryClient.setQueryData(['milking-records', animalId], (old: any[] = []) => 
        [optimisticRecord, ...old]
      );

      // Refetch milk inventory
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `single_milk_${Date.now()}`,
          type: 'single_milk',
          payload: {
            farmId,
            singleMilk: {
              animalId,
              animalName,
              earTag,
              liters: litersNum,
              recordDate: dateStr,
              session,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `${litersNum}L (${session}) will sync when online`,
        });
        onOpenChange(false);
        return;
      }

      // Online: insert directly
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("milking_records")
        .insert({
          animal_id: animalId,
          record_date: dateStr,
          liters: litersNum,
          session: session,
          created_by: user?.id,
          is_sold: false,
          client_generated_id: clientId,
        });

      if (error) throw error;

      // Refetch to sync with server
      await queryClient.refetchQueries({ 
        queryKey: ['milking-records', animalId],
        type: 'active',
      });
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });

      hapticNotification('success');
      toast({
        title: "Milk Recorded",
        description: `${litersNum}L (${session}) added to inventory`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording milk:", error);

      // Rollback optimistic update
      queryClient.setQueryData(['milking-records', animalId], (old: any[] = []) => 
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );

      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to record milk production",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(liters) > 0;
  const displayName = animalName || earTag || 'This animal';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Milk className="h-5 w-5 text-blue-500" />
            Record Milk Production
            <div className="ml-auto flex items-center gap-2">
              <VoiceFormInput
                extractorType="milk"
                onDataExtracted={handleVoiceDataExtracted}
                offlineMode="queue"
                formType="milk"
                size="sm"
              />
              {!isOnline && (
                <span className="flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </span>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Record milk production for {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Animal Display (read-only) */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs text-muted-foreground">Animal</Label>
            <div className="font-medium">
              {animalName || 'Unnamed'}
              {earTag && <span className="text-muted-foreground ml-2">#{earTag}</span>}
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left min-h-[48px]",
                    !recordDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(recordDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recordDate}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    date > new Date() || date < subDays(new Date(), 7)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* AM/PM Session */}
          <div className="space-y-2">
            <Label>Session</Label>
            <RadioGroup
              value={session}
              onValueChange={handleSessionChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AM" id="single-am" />
                <Label htmlFor="single-am" className="flex items-center gap-1.5 cursor-pointer">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Morning
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PM" id="single-pm" />
                <Label htmlFor="single-pm" className="flex items-center gap-1.5 cursor-pointer">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  Evening
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Liters Input */}
          <div className="space-y-2">
            <Label htmlFor="single-liters">Liters Collected</Label>
            <Input
              id="single-liters"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 5.5"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 min-h-[48px]"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 min-h-[48px]"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isOnline ? "Recording..." : "Queuing..."}
                </>
              ) : (
                <>
                  {!isOnline && <WifiOff className="h-4 w-4 mr-2" />}
                  {isOnline ? "Record Milk" : "Queue for Sync"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

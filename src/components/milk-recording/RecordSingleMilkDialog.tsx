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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Milk, CalendarIcon, Sun, Moon, Clock, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { VoiceRecordWithExtraction } from "@/components/ui/VoiceRecordWithExtraction";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { addLocalMilkRecord, addLocalMilkInventoryRecord } from "@/lib/dataCache";
import { validateRecordDate } from "@/lib/recordValidation";
import { ExtractedMilkData } from "@/lib/voiceFormExtractors";
import { useFarm } from "@/contexts/FarmContext";
import { MilkQualityFields } from "./MilkQualityFields";
import type { MilkQuality } from "@/constants/milkQuality";

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
  const [session, setSession] = useState<'AM' | 'PM' | 'Full Day'>(
    new Date().getHours() < 12 ? 'AM' : 'PM'
  );
  const [milkQuality, setMilkQuality] = useState<MilkQuality>('good');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { maxBackdateDays } = useFarm();

  useEffect(() => {
    if (open) hapticImpact('light');
  }, [open]);

  useEffect(() => {
    if (!open) {
      setLiters("");
      setRecordDate(new Date());
      setSession(new Date().getHours() < 12 ? 'AM' : 'PM' as 'AM' | 'PM' | 'Full Day');
      setMilkQuality('good');
      setRejectionReason('');
    }
  }, [open]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) { hapticSelection(); setRecordDate(date); }
  };

  const handleSessionChange = (value: string) => {
    hapticSelection();
    setSession(value as 'AM' | 'PM' | 'Full Day');
  };

  const handleClose = () => { hapticImpact('light'); onOpenChange(false); };

  const handleVoiceDataExtracted = (data: ExtractedMilkData) => {
    if (data.totalLiters) setLiters(data.totalLiters.toString());
    if (data.session) setSession(data.session);
  };

  const handleSubmit = async () => {
    if (!farmId || !animalId) return;

    const litersNum = parseFloat(liters);
    if (isNaN(litersNum) || litersNum <= 0) {
      toast({ title: "Invalid Liters", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    const dateStr = format(recordDate, "yyyy-MM-dd");
    const validation = validateRecordDate(dateStr, { farm_entry_date: farmEntryDate });
    if (!validation.valid) {
      toast({ title: "Invalid Date", description: validation.message, variant: "destructive" });
      return;
    }

    const isRejected = milkQuality === 'rejected';

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();

    try {
      await addLocalMilkRecord(farmId, dateStr, litersNum);

      const clientId = `${optimisticId}_milk_0`;
      await addLocalMilkInventoryRecord(farmId, {
        id: `optimistic-${clientId}`,
        milking_record_id: clientId,
        animal_id: animalId,
        animal_name: animalName || 'Unknown',
        ear_tag: earTag,
        livestock_type: 'cattle',
        record_date: dateStr,
        liters_original: litersNum,
        liters_remaining: isRejected ? 0 : litersNum,
        is_available: !isRejected,
        created_at: new Date().toISOString(),
        syncStatus: 'pending',
      });

      const optimisticRecord = {
        id: `optimistic-${optimisticId}`,
        animal_id: animalId,
        record_date: dateStr,
        liters: litersNum,
        session,
        is_sold: false,
        milk_quality: milkQuality,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      };

      queryClient.setQueryData(['milking-records', animalId], (old: any[] = []) => 
        [optimisticRecord, ...old]
      );

      await queryClient.refetchQueries({ queryKey: ['milk-inventory', farmId], type: 'active' });

      if (!isOnline) {
        await addToQueue({
          id: `single_milk_${Date.now()}`,
          type: 'single_milk',
          payload: {
            farmId,
            singleMilk: {
              animalId, animalName, earTag,
              liters: litersNum, recordDate: dateStr, session,
              milkQuality, rejectionReason,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "✅ Milk Recorded",
          description: `${litersNum}L${isRejected ? ' (Rejected)' : ''} (${session}). Syncs automatically when online`,
        });
        onOpenChange(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("milking_records")
        .insert({
          animal_id: animalId,
          record_date: dateStr,
          liters: litersNum,
          session,
          created_by: user?.id,
          is_sold: false,
          client_generated_id: clientId,
          milk_quality: milkQuality,
          milk_quality_rejection_reason: rejectionReason || null,
        } as any);

      if (error) throw error;

      await queryClient.refetchQueries({ queryKey: ['milking-records', animalId], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['milk-inventory', farmId], type: 'active' });

      hapticNotification('success');
      toast({
        title: isRejected ? "Rejected Milk Recorded" : "Milk Recorded",
        description: `${litersNum}L${isRejected ? ' (Rejected)' : ''} (${session}) added`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording milk:", error);
      queryClient.setQueryData(['milking-records', animalId], (old: any[] = []) => 
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );
      hapticNotification('error');
      toast({ title: "Error", description: "Failed to record milk production", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(liters) > 0;
  const displayName = animalName || earTag || 'This animal';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Milk className="h-5 w-5 text-blue-500" />
            Record Milk Production
            <div className="ml-auto flex items-center gap-2">
              <VoiceRecordWithExtraction
                extractorType="milk"
                onDataExtracted={handleVoiceDataExtracted}
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

        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs text-muted-foreground">Animal</Label>
            <div className="font-medium">
              {animalName || 'Unnamed'}
              {earTag && <span className="text-muted-foreground ml-2">#{earTag}</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left min-h-[48px]", !recordDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(recordDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={recordDate} onSelect={handleDateSelect} disabled={(date) => date > new Date() || date < subDays(new Date(), maxBackdateDays)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Session</Label>
            <Select value={session} onValueChange={handleSessionChange}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM"><span className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />Morning (AM)</span></SelectItem>
                <SelectItem value="PM"><span className="flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-500" />Evening (PM)</span></SelectItem>
                <SelectItem value="Full Day"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Full Day</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="single-liters">Liters Collected</Label>
            <Input id="single-liters" type="number" step="0.1" min="0" placeholder="e.g. 5.5" value={liters} onChange={(e) => setLiters(e.target.value)} onFocus={() => hapticImpact('light')} className="min-h-[48px]" />
          </div>

          <MilkQualityFields
            milkQuality={milkQuality}
            rejectionReason={rejectionReason}
            onQualityChange={setMilkQuality}
            onRejectionReasonChange={setRejectionReason}
          />

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 min-h-[48px]" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1 min-h-[48px]" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Recording...</>) : "Record Milk"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

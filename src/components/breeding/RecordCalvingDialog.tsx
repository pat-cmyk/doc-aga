/**
 * RecordCalvingDialog - Records a calving event for a pregnant animal
 *
 * This dialog:
 * - Inserts a 'calving' breeding_event (triggers DB state machine -> fresh_postpartum)
 * - The DB trigger automatically: increments parity, sets last_calving_date,
 *   resets services_this_cycle, sets voluntary_waiting_end_date
 * - Optionally registers the newborn calf as a new animal
 * - Auto-links sire from the AI record (father_id on calf)
 * - Auto-derives calf breed from dam + sire breeds
 * - Validates calving date against expected delivery date
 * - Prompts for post-calving placenta check
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Baby, Loader2, AlertTriangle, Calendar, Info } from 'lucide-react';
import { calculateLifeStage } from '@/lib/animalStages';
import { supabase } from '@/integrations/supabase/client';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { useToast } from '@/hooks/use-toast';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { playSound } from '@/lib/audioFeedback';
import { hapticNotification } from '@/lib/haptics';
import { getCacheManager, isCacheManagerReady } from '@/lib/cacheManager';
import { differenceInDays, format } from 'date-fns';

interface PregnancyContext {
  expectedDeliveryDate: string | null;
  aiPerformedDate: string | null;
  sireId: string | null;
  sireBreed: string | null;
  semenCode: string | null;
  aiRecordId: string | null;
}

interface RecordCalvingDialogProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  livestockType?: string;
  animalBreed?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RecordCalvingDialog({
  animalId,
  farmId,
  animalName,
  livestockType = 'cattle',
  animalBreed,
  trigger,
  onSuccess
}: RecordCalvingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calvingDate, setCalvingDate] = useState(new Date().toISOString().split('T')[0]);
  const [calfGender, setCalfGender] = useState<string>('');
  const [calfName, setCalfName] = useState('');
  const [registerCalf, setRegisterCalf] = useState(true);
  const [birthWeight, setBirthWeight] = useState('');
  const [calvingDifficulty, setCalvingDifficulty] = useState('normal');
  const [calfOutcome, setCalfOutcome] = useState<'alive' | 'stillborn'>('alive');
  const [notes, setNotes] = useState('');
  const [pregnancyContext, setPregnancyContext] = useState<PregnancyContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  // Post-calving placenta check (shown after successful recording)
  const [showPlacentaCheck, setShowPlacentaCheck] = useState(false);
  const [placentaExpelled, setPlacentaExpelled] = useState<boolean | null>(null);
  const [calvingEventMetadata, setCalvingEventMetadata] = useState<Record<string, unknown> | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // Load pregnancy context when dialog opens
  const loadPregnancyContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      // Get latest AI record with pregnancy info
      const { data: aiRecord } = await supabase
        .from('ai_records')
        .select('id, performed_date, expected_delivery_date, semen_code, notes')
        .eq('animal_id', animalId)
        .not('performed_date', 'is', null)
        .order('performed_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let sireId: string | null = null;
      let sireBreed: string | null = null;

      if (aiRecord) {
        // Try to extract breed from AI record notes (format: "Brand: X | Ref: Y | Breed: Z")
        const breedMatch = aiRecord.notes?.match(/Breed:\s*([^|]+)/i);
        sireBreed = breedMatch ? breedMatch[1].trim() : null;
      }

      // Also check breeding_events for pregnancy_confirmed metadata
      let expectedDate = aiRecord?.expected_delivery_date || null;
      if (!expectedDate) {
        const { data: pregEvent } = await supabase
          .from('breeding_events')
          .select('metadata')
          .eq('animal_id', animalId)
          .eq('event_type', 'pregnancy_confirmed')
          .order('event_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        expectedDate = (pregEvent?.metadata as any)?.expected_delivery_date || null;
      }

      setPregnancyContext({
        expectedDeliveryDate: expectedDate,
        aiPerformedDate: aiRecord?.performed_date || null,
        sireId,
        sireBreed,
        semenCode: aiRecord?.semen_code || null,
        aiRecordId: aiRecord?.id || null,
      });
    } catch (error) {
      console.error('Error loading pregnancy context:', error);
    } finally {
      setLoadingContext(false);
    }
  }, [animalId]);

  useEffect(() => {
    if (open) {
      loadPregnancyContext();
    }
  }, [open, loadPregnancyContext]);

  // Calculate days off from expected delivery
  const getCalvingDateWarning = (): string | null => {
    if (!pregnancyContext?.expectedDeliveryDate || !calvingDate) return null;
    const daysOff = Math.abs(
      differenceInDays(new Date(calvingDate), new Date(pregnancyContext.expectedDeliveryDate))
    );
    if (daysOff > 30) {
      return `Calving date is ${daysOff} days off from expected delivery (${format(new Date(pregnancyContext.expectedDeliveryDate), 'MMM d, yyyy')}). Verify if correct.`;
    }
    return null;
  };

  // Derive calf breed from dam + sire
  const deriveCalfBreed = (): string => {
    const damBreed = animalBreed || 'Unknown';
    const sireBreed = pregnancyContext?.sireBreed || 'Unknown';
    if (damBreed === sireBreed && damBreed !== 'Unknown') {
      return damBreed; // Same breed = purebred
    }
    return `${damBreed} x ${sireBreed}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calvingDate) {
      toast({ title: "Calving date required", variant: "destructive" });
      return;
    }

    // Require gender if registering a live calf
    if (registerCalf && calfOutcome === 'alive' && !calfGender) {
      toast({ title: "Calf gender required for registration", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const metadata: Record<string, unknown> = {
        calving_difficulty: calvingDifficulty,
        calf_outcome: calfOutcome,
        calf_gender: calfGender || null,
        calf_registered: calfOutcome === 'alive' && registerCalf,
        birth_weight_kg: birthWeight ? parseFloat(birthWeight) : null,
        sire_semen_code: pregnancyContext?.semenCode || null,
      };

      // 1. Insert calving breeding event (triggers state machine)
      const result = await insertBreedingEvent({
        animalId,
        farmId,
        eventType: 'calving',
        eventDate: calvingDate,
        relatedAiRecordId: pregnancyContext?.aiRecordId || undefined,
        notes: notes || undefined,
        metadata,
      });

      if (!result.success) {
        toast({
          title: "Failed to record calving / Hindi naitala ang panganganak",
          description: "The calving event could not be saved. Please try again. / Hindi na-save. Subukan ulit.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 2. Register calf if alive and opted in
      if (calfOutcome === 'alive' && registerCalf && calfGender) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        const uniqueCode = `CALF-${timestamp}-${random}`;

        const calfBreed = deriveCalfBreed();

        // Compute species-specific life stage for newborn (e.g. "Calf", "Carabao Calf", "Kid", "Lamb")
        const calfLifeStage = calculateLifeStage({
          birthDate: new Date(calvingDate),
          gender: calfGender,
          livestockType: livestockType || 'cattle',
          offspringCount: 0,
          hasActiveAI: false,
          milkingStartDate: null,
          lastCalvingDate: null,
          hasRecentMilking: false,
        });

        const { error: calfError } = await supabase.from('animals').insert([{
          farm_id: farmId,
          name: calfName || null,
          gender: calfGender,
          breed: calfBreed !== 'Unknown x Unknown' ? calfBreed : null,
          birth_date: calvingDate,
          birth_weight_kg: birthWeight ? parseFloat(birthWeight) : null,
          mother_id: animalId,
          father_id: pregnancyContext?.sireId || null,
          livestock_type: livestockType,
          unique_code: uniqueCode,
          acquisition_type: 'born_on_farm',
          farm_entry_date: calvingDate,
          fertility_status: 'not_eligible',
          life_stage: calfLifeStage,
        }]);

        if (calfError) {
          console.error('Failed to register calf:', calfError);
          toast({
            title: "Calving recorded, but calf registration failed",
            description: calfError.message,
            variant: "destructive",
          });
        }
      }

      // 3. Update the dam's milking status to restart lactation
      await supabase.from('animals').update({
        is_currently_lactating: true,
        milking_stage: 'early_lactation',
        milking_start_date: calvingDate,
        estimated_days_in_milk: 0,
      }).eq('id', animalId);

      // 4. Clear the AI record pregnancy (calving resolves pregnancy)
      if (pregnancyContext?.aiRecordId) {
        await supabase
          .from('ai_records')
          .update({ pregnancy_confirmed: false })
          .eq('id', pregnancyContext.aiRecordId);
      }

      playSound('success');
      hapticNotification('success');

      // Invalidate breeding + animal caches so timeline, profile, and dashboard refresh
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('breeding-event', farmId);
        await getCacheManager().invalidateForMutation('animal', farmId);
      }

      // Store metadata for potential placenta update later
      setCalvingEventMetadata(metadata);

      // Show post-calving placenta check
      setShowPlacentaCheck(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlacentaResponse = async (expelled: boolean) => {
    setPlacentaExpelled(expelled);

    // Update the calving breeding event metadata with placenta info
    try {
      const { data: calvingEvent } = await supabase
        .from('breeding_events')
        .select('id, metadata')
        .eq('animal_id', animalId)
        .eq('event_type', 'calving')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (calvingEvent) {
        const updatedMetadata = {
          ...(calvingEvent.metadata as Record<string, unknown> || {}),
          placenta_expelled: expelled,
          placenta_checked_at: new Date().toISOString(),
        };
        await supabase
          .from('breeding_events')
          .update({ metadata: updatedMetadata as any })
          .eq('id', calvingEvent.id);
      }
    } catch (error) {
      console.error('Error updating placenta check:', error);
    }

    if (!expelled) {
      toast({
        title: "Warning: Retained Placenta / Babala: Nanatiling Inunan",
        description: "Monitor the dam closely. Contact a vet if the placenta is not expelled within 12 hours. / Bantayan ang ina. Tumawag ng vet kung hindi lumabas ang inunan sa loob ng 12 oras.",
        variant: "destructive",
        duration: 10000,
      });
    } else {
      toast({
        title: "Calving Recorded! / Naitala ang Panganganak!",
        description: calfOutcome === 'alive' && registerCalf && calfGender
          ? "Calf registered. Dam moved to postpartum recovery. / Naitala ang guya. Nasa pahinga ang ina."
          : "Dam moved to postpartum recovery. / Nasa pahinga ang ina.",
      });
    }

    setOpen(false);
    resetForm();
    onSuccess?.();
  };

  const handleSkipPlacentaCheck = () => {
    toast({
      title: "Calving Recorded! / Naitala ang Panganganak!",
      description: calfOutcome === 'alive' && registerCalf && calfGender
        ? "Calf registered. Dam moved to postpartum recovery. / Naitala ang guya. Nasa pahinga ang ina."
        : "Dam moved to postpartum recovery. / Nasa pahinga ang ina.",
    });
    setOpen(false);
    resetForm();
    onSuccess?.();
  };

  const resetForm = () => {
    setCalvingDate(new Date().toISOString().split('T')[0]);
    setCalfGender('');
    setCalfName('');
    setRegisterCalf(true);
    setBirthWeight('');
    setCalvingDifficulty('normal');
    setCalfOutcome('alive');
    setNotes('');
    setShowPlacentaCheck(false);
    setPlacentaExpelled(null);
    setCalvingEventMetadata(null);
    setPregnancyContext(null);
  };

  const calvingDateWarning = getCalvingDateWarning();

  // Calculate days pregnant for display
  const getDaysPregnant = (): number | null => {
    if (!pregnancyContext?.aiPerformedDate) return null;
    return differenceInDays(new Date(), new Date(pregnancyContext.aiPerformedDate));
  };

  const daysPregnant = getDaysPregnant();

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && showPlacentaCheck) {
        // If closing during placenta check, still finalize
        handleSkipPlacentaCheck();
        return;
      }
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Baby className="h-4 w-4 text-pink-500" />
            Record Calving
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5 text-pink-500" />
            {showPlacentaCheck ? 'Post-Calving Check' : 'Record Calving'}
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
        </DialogHeader>

        {showPlacentaCheck ? (
          /* Post-calving placenta check */
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-sm">
                Lumabas ba ang inunan? / Did the placenta come out?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Retained placenta (&gt;12 hours) needs veterinary attention.
                / Kung hindi lumabas sa 12 oras, kailangan ng vet.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handlePlacentaResponse(false)}
              >
                Hindi pa / Not yet
              </Button>
              <Button
                className="flex-1"
                onClick={() => handlePlacentaResponse(true)}
              >
                Oo, lumabas na / Yes
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleSkipPlacentaCheck}
            >
              Skip / Laktawan
            </Button>
          </div>
        ) : (
          /* Main calving form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
            {/* Pregnancy Context Info */}
            {pregnancyContext?.expectedDeliveryDate && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>Pregnancy Info</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Expected: {format(new Date(pregnancyContext.expectedDeliveryDate), 'MMM d, yyyy')}
                  </span>
                  {daysPregnant !== null && (
                    <span>{daysPregnant} days pregnant</span>
                  )}
                  {pregnancyContext.semenCode && (
                    <span>Semen: {pregnancyContext.semenCode}</span>
                  )}
                </div>
              </div>
            )}

            {/* Calving Date */}
            <div>
              <Label htmlFor="calving_date">Calving Date / Petsa ng Panganganak *</Label>
              <Input
                id="calving_date"
                type="date"
                value={calvingDate}
                onChange={(e) => setCalvingDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
              />
              {calvingDateWarning && (
                <div className="flex items-start gap-1.5 mt-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{calvingDateWarning}</span>
                </div>
              )}
            </div>

            {/* Calving Difficulty */}
            <div>
              <Label>Calving Difficulty / Kahirapan</Label>
              <Select value={calvingDifficulty} onValueChange={setCalvingDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">1 - Normal (Unassisted / Walang tulong)</SelectItem>
                  <SelectItem value="slight_assist">2 - Slight Assistance / Kaunting tulong</SelectItem>
                  <SelectItem value="moderate_assist">3 - Moderate (Mechanical pull / May hilang gamit)</SelectItem>
                  <SelectItem value="difficult">4 - Difficult (Major force / Malakas na hila)</SelectItem>
                  <SelectItem value="cesarean">5 - Cesarean Section / Tinistis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calf Outcome - Alive or Stillborn */}
            <div>
              <Label>Calf Outcome / Resulta ng Guya</Label>
              <Select value={calfOutcome} onValueChange={(v) => {
                setCalfOutcome(v as 'alive' | 'stillborn');
                if (v === 'stillborn') {
                  setRegisterCalf(false);
                } else {
                  setRegisterCalf(true);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alive">Alive / Buhay</SelectItem>
                  <SelectItem value="stillborn">Stillborn / Patay sa pagsilang</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Register Calf Toggle - only for alive calves */}
            {calfOutcome === 'alive' && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="font-medium">Register Calf / Itala ang Guya</Label>
                  <p className="text-sm text-muted-foreground">
                    Add the newborn to the herd / Idagdag sa kawan
                  </p>
                </div>
                <Switch checked={registerCalf} onCheckedChange={setRegisterCalf} />
              </div>
            )}

            {calfOutcome === 'alive' && registerCalf && (
              <div className="space-y-3 rounded-lg border p-3">
                {/* Calf Gender */}
                <div>
                  <Label>Calf Gender / Kasarian ng Guya *</Label>
                  <Select value={calfGender} onValueChange={setCalfGender}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender / Pumili ng kasarian" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female / Babae (Heifer Calf)</SelectItem>
                      <SelectItem value="Male">Male / Lalaki (Bull Calf)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Calf Name */}
                <div>
                  <Label>Calf Name / Pangalan ng Guya (Optional)</Label>
                  <Input
                    value={calfName}
                    onChange={(e) => setCalfName(e.target.value)}
                    placeholder="Enter calf name / Ilagay ang pangalan"
                  />
                </div>

                {/* Birth Weight */}
                <div>
                  <Label>Birth Weight / Timbang sa Pagsilang (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={birthWeight}
                    onChange={(e) => setBirthWeight(e.target.value)}
                    placeholder="e.g. 35"
                  />
                </div>

                {/* Derived Breed Preview */}
                {animalBreed && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    <span>Breed: {deriveCalfBreed()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Notes / Mga Tala (Optional)</Label>
              <div className="flex gap-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Calving observations... / Mga obserbasyon sa panganganak..."
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
                Cancel / Kanselahin
              </Button>
              <Button
                type="submit"
                disabled={loading || (calfOutcome === 'alive' && registerCalf && !calfGender)}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {loading ? 'Recording...' : 'Record Calving / Itala'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * RecordCalvingDialog - Records a calving event for a pregnant animal
 * 
 * This dialog:
 * - Inserts a 'calving' breeding_event (triggers DB state machine → fresh_postpartum)
 * - The DB trigger automatically: increments parity, sets last_calving_date, 
 *   resets services_this_cycle, sets voluntary_waiting_end_date
 * - Optionally registers the newborn calf as a new animal
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Baby, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { insertBreedingEvent } from '@/lib/breedingEventBridge';
import { useToast } from '@/hooks/use-toast';
import { VoiceInputButton } from '@/components/ui/voice-input-button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface RecordCalvingDialogProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  livestockType?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RecordCalvingDialog({ 
  animalId, 
  farmId, 
  animalName, 
  livestockType = 'cattle',
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
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calvingDate) {
      toast({ title: "Calving date required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // 1. Insert calving breeding event (triggers state machine)
      await insertBreedingEvent({
        animalId,
        farmId,
        eventType: 'calving',
        eventDate: calvingDate,
        notes: notes || undefined,
        metadata: {
          calving_difficulty: calvingDifficulty,
          calf_gender: calfGender || null,
          calf_registered: registerCalf,
          birth_weight_kg: birthWeight ? parseFloat(birthWeight) : null,
        },
      });

      // 2. Optionally register the calf as a new animal
      if (registerCalf && calfGender) {
        // Generate a unique code for the calf
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        const uniqueCode = `CALF-${timestamp}-${random}`;

        const { error: calfError } = await supabase.from('animals').insert([{
          farm_id: farmId,
          name: calfName || null,
          gender: calfGender,
          birth_date: calvingDate,
          birth_weight_kg: birthWeight ? parseFloat(birthWeight) : null,
          mother_id: animalId,
          livestock_type: livestockType,
          unique_code: uniqueCode,
          acquisition_type: 'born_on_farm',
          farm_entry_date: calvingDate,
          fertility_status: 'not_eligible',
          life_stage: 'calf',
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

      toast({
        title: "Calving Recorded! 🎉",
        description: registerCalf && calfGender
          ? `Calf registered. Dam moved to postpartum recovery.`
          : `Dam moved to postpartum recovery period.`,
      });

      setOpen(false);
      resetForm();
      onSuccess?.();
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

  const resetForm = () => {
    setCalvingDate(new Date().toISOString().split('T')[0]);
    setCalfGender('');
    setCalfName('');
    setRegisterCalf(true);
    setBirthWeight('');
    setCalvingDifficulty('normal');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Record Calving
            {animalName && <span className="text-muted-foreground">- {animalName}</span>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
          {/* Calving Date */}
          <div>
            <Label htmlFor="calving_date">Calving Date *</Label>
            <Input
              id="calving_date"
              type="date"
              value={calvingDate}
              onChange={(e) => setCalvingDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Calving Difficulty */}
          <div>
            <Label>Calving Difficulty</Label>
            <Select value={calvingDifficulty} onValueChange={setCalvingDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal (Unassisted)</SelectItem>
                <SelectItem value="slight_assist">Slight Assistance</SelectItem>
                <SelectItem value="difficult">Difficult (Major Assist)</SelectItem>
                <SelectItem value="cesarean">Cesarean Section</SelectItem>
                <SelectItem value="stillborn">Stillborn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Register Calf Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="font-medium">Register Calf</Label>
              <p className="text-sm text-muted-foreground">
                Add the newborn to the herd
              </p>
            </div>
            <Switch checked={registerCalf} onCheckedChange={setRegisterCalf} />
          </div>

          {registerCalf && (
            <div className="space-y-3 rounded-lg border p-3">
              {/* Calf Gender */}
              <div>
                <Label>Calf Gender *</Label>
                <Select value={calfGender} onValueChange={setCalfGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female (Heifer Calf)</SelectItem>
                    <SelectItem value="Male">Male (Bull Calf)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Calf Name */}
              <div>
                <Label>Calf Name (Optional)</Label>
                <Input
                  value={calfName}
                  onChange={(e) => setCalfName(e.target.value)}
                  placeholder="Enter calf name"
                />
              </div>

              {/* Birth Weight */}
              <div>
                <Label>Birth Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={birthWeight}
                  onChange={(e) => setBirthWeight(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <div className="flex gap-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Calving observations..."
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
            <Button type="submit" disabled={loading || (registerCalf && !calfGender)}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Recording...' : 'Record Calving'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

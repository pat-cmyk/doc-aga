import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCacheManager, isCacheManagerReady } from '@/lib/cacheManager';

export interface HeatRecord {
  id: string;
  animal_id: string;
  farm_id: string;
  detected_at: string;
  detection_method: string;
  intensity: string | null;
  standing_heat: boolean | null;
  optimal_breeding_start: string | null;
  optimal_breeding_end: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateHeatRecordData {
  animal_id: string;
  farm_id: string;
  detected_at?: string;
  detection_method: string;
  intensity?: string;
  standing_heat?: boolean;
  notes?: string;
}

// Calculate optimal breeding window (12-30 hours after standing heat detected)
function calculateBreedingWindow(detectedAt: string, standingHeat: boolean) {
  if (!standingHeat) return { start: null, end: null };
  
  const detected = new Date(detectedAt);
  const start = new Date(detected.getTime() + 12 * 60 * 60 * 1000); // 12 hours later
  const end = new Date(detected.getTime() + 30 * 60 * 60 * 1000); // 30 hours later
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function useHeatRecords(animalId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: heatRecords = [], isLoading } = useQuery({
    queryKey: ['heat-records', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('heat_records')
        .select('*')
        .eq('animal_id', animalId)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return data as HeatRecord[];
    },
    enabled: !!animalId,
  });

  const createHeatRecord = useMutation({
    mutationFn: async (data: CreateHeatRecordData) => {
      const { data: userData } = await supabase.auth.getUser();
      const breedingWindow = calculateBreedingWindow(
        data.detected_at || new Date().toISOString(),
        data.standing_heat || false
      );

      const { error } = await supabase.from('heat_records').insert({
        animal_id: data.animal_id,
        farm_id: data.farm_id,
        detected_at: data.detected_at || new Date().toISOString(),
        detection_method: data.detection_method,
        intensity: data.intensity || 'normal',
        standing_heat: data.standing_heat || false,
        optimal_breeding_start: breedingWindow.start,
        optimal_breeding_end: breedingWindow.end,
        notes: data.notes,
        created_by: userData?.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['heat-records', animalId] });
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('heat-record', variables.farm_id);
      }
      toast({
        title: 'Heat Record Added',
        description: 'Heat detection recorded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate average cycle length
  const averageCycleLength = heatRecords.length >= 2
    ? (() => {
        const sortedRecords = [...heatRecords].sort(
          (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
        );
        let totalDays = 0;
        let cycles = 0;
        for (let i = 1; i < sortedRecords.length; i++) {
          const diff = new Date(sortedRecords[i].detected_at).getTime() - 
                       new Date(sortedRecords[i - 1].detected_at).getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          if (days >= 15 && days <= 30) { // Valid cycle range
            totalDays += days;
            cycles++;
          }
        }
        return cycles > 0 ? Math.round(totalDays / cycles) : null;
      })()
    : null;

  return {
    heatRecords,
    isLoading,
    createHeatRecord,
    averageCycleLength,
  };
}

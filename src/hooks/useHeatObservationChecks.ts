import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface HeatObservationCheck {
  animal_id: string;
  checked_at: string;
  checked_by: string | null;
}

export function useHeatObservationChecks(farmId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const todayStart = startOfDay(new Date()).toISOString();

  const { data: todaysChecks, isLoading } = useQuery({
    queryKey: ['heat-observation-checks', farmId, 'today'],
    queryFn: async (): Promise<HeatObservationCheck[]> => {
      if (!farmId) return [];

      const { data, error } = await supabase
        .from('heat_observation_checks')
        .select('animal_id, checked_at, checked_by')
        .eq('farm_id', farmId)
        .gte('checked_at', todayStart);

      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const markAsChecked = useMutation({
    mutationFn: async (animalId: string) => {
      if (!farmId) throw new Error('Farm ID is required');

      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('heat_observation_checks').insert({
        animal_id: animalId,
        farm_id: farmId,
        checked_at: new Date().toISOString(),
        checked_by: userData.user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heat-observation-checks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-heat-monitoring'] });
      toast({
        title: 'Observation Recorded',
        description: 'No heat signs observed today.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to record observation. Please try again.',
        variant: 'destructive',
      });
      console.error('Failed to mark as checked:', error);
    },
  });

  const checkedAnimalIds = new Set(todaysChecks?.map(c => c.animal_id) || []);

  return {
    todaysChecks,
    isLoading,
    markAsChecked,
    checkedAnimalIds,
  };
}

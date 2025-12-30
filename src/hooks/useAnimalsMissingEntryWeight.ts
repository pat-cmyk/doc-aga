import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AnimalMissingWeight {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

export function useAnimalsMissingEntryWeight(farmId?: string, limit: number = 3) {
  return useQuery({
    queryKey: ['animals-missing-entry-weight', farmId, limit],
    queryFn: async () => {
      if (!farmId) return [];

      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null)
        .is('entry_weight_kg', null)
        .or('entry_weight_unknown.is.null,entry_weight_unknown.eq.false')
        .limit(limit);

      if (error) throw error;
      return (data || []) as AnimalMissingWeight[];
    },
    enabled: !!farmId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

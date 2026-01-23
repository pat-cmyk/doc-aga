import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FarmSettings {
  maxBackdateDays: number;
}

export function useFarmSettings(farmId: string | null) {
  return useQuery({
    queryKey: ['farm-settings', farmId],
    queryFn: async (): Promise<FarmSettings> => {
      if (!farmId) {
        return { maxBackdateDays: 7 };
      }
      
      const { data, error } = await supabase
        .from('farms')
        .select('max_backdate_days')
        .eq('id', farmId)
        .single();
      
      if (error) {
        console.error('Error fetching farm settings:', error);
        return { maxBackdateDays: 7 };
      }
      
      return {
        maxBackdateDays: data?.max_backdate_days ?? 7
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useUpdateFarmSettings(farmId: string | null) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<{ maxBackdateDays: number }>) => {
      if (!farmId) throw new Error('No farm ID provided');
      
      const updateData: Record<string, unknown> = {};
      if (settings.maxBackdateDays !== undefined) {
        updateData.max_backdate_days = settings.maxBackdateDays;
      }
      
      const { error } = await supabase
        .from('farms')
        .update(updateData)
        .eq('id', farmId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-settings', farmId] });
    },
  });
}

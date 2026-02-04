import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BackdatingSetting {
  enabled: boolean;
  max_days: number;
}

export interface PlatformSettings {
  backdatingEnabled: boolean;
  maxBackdateDays: number;
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings', 'backdating'],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'backdating')
        .single();
      
      if (error || !data) {
        console.error('Error fetching platform settings:', error);
        // Safe default: enforcement OFF during acquisition phase
        return { backdatingEnabled: false, maxBackdateDays: 7 };
      }
      
      const value = data.setting_value as unknown as BackdatingSetting;
      return {
        backdatingEnabled: value?.enabled ?? false,
        maxBackdateDays: value?.max_days ?? 7
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: { enabled: boolean; maxDays: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('platform_settings')
        .update({ 
          setting_value: { 
            enabled: settings.enabled, 
            max_days: settings.maxDays 
          },
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('setting_key', 'backdating');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
  });
}

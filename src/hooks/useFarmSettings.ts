/**
 * @cache-status MANAGED — Cache-first via IndexedDB (farmSettingsCache, 60 min TTL)
 * Mutations route through CacheManager 'farm-settings' type
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCacheManager } from "@/lib/cacheManager";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedFarmSettings, updateFarmSettingsCache } from "@/lib/dataCache";

export interface FarmSettings {
  maxBackdateDays: number;
}

const DEFAULT_SETTINGS: FarmSettings = { maxBackdateDays: 7 };

export function useFarmSettings(farmId: string | null) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['farm-settings', farmId],
    queryFn: async (): Promise<FarmSettings> => {
      if (!farmId) return DEFAULT_SETTINGS;

      // 1. Check IndexedDB cache first
      const cached = await getCachedFarmSettings(farmId);
      if (cached) return cached.data as FarmSettings;

      // 2. If offline with no cache, return default
      if (!isOnline) return DEFAULT_SETTINGS;

      // 3. Fetch from Supabase
      const { data, error } = await supabase
        .from('farms')
        .select('max_backdate_days')
        .eq('id', farmId)
        .single();
      
      if (error) {
        console.error('Error fetching farm settings:', error);
        return DEFAULT_SETTINGS;
      }
      
      const result: FarmSettings = {
        maxBackdateDays: data?.max_backdate_days ?? 7
      };

      // 4. Update cache
      await updateFarmSettingsCache(farmId, result);

      return result;
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateFarmSettings(farmId: string | null) {
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
      if (farmId) {
        getCacheManager().invalidateForMutation('farm-settings', farmId);
      }
    },
  });
}

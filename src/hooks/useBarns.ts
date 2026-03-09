/**
 * @cache-status MANAGED — Cache-first via IndexedDB (barnsCache + barnAssignmentsCache, 30 min TTL)
 * Mutations route through CacheManager 'barn' type
 * Offline-capable: all CRUD operations work offline via optimistic updates + queue
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCacheManager } from "@/lib/cacheManager";
import { useOnlineStatus, getIsOnline } from "@/hooks/useOnlineStatus";
import {
  getCachedBarns,
  updateBarnsCache,
  getCachedBarnAssignments,
  updateBarnAssignmentsCache,
  updateLocalBarnAssignment,
  updateLocalBarn,
  updateLocalAnimalBarn,
  getCachedAnimals,
} from "@/lib/dataCache";
import { addToQueue } from "@/lib/offlineQueue";

export interface Barn {
  id: string;
  farm_id: string;
  name: string;
  description: string | null;
  barn_type: string;
  capacity: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  animal_count?: number;
}

export interface BarnAssignment {
  id: string;
  barn_id: string;
  animal_id: string;
  assigned_at: string;
  removed_at: string | null;
  assigned_by: string | null;
  farm_id: string;
  animal?: {
    id: string;
    name: string | null;
    ear_tag: string | null;
    livestock_type: string;
    current_barn_id: string | null;
  };
}

export function useBarns(farmId: string | null) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['barns', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      // 1. Check IndexedDB cache first
      const cached = await getCachedBarns(farmId);
      if (cached) return cached.data as Barn[];

      // 2. If offline with no cache, return empty
      if (!isOnline) return [];

      // 3. Fetch from Supabase
      const { data, error } = await supabase
        .from('barns')
        .select('*')
        .eq('farm_id', farmId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const { data: counts, error: countError } = await supabase
        .from('barn_assignments')
        .select('barn_id')
        .eq('farm_id', farmId)
        .is('removed_at', null);

      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      (counts || []).forEach((a: { barn_id: string }) => {
        countMap[a.barn_id] = (countMap[a.barn_id] || 0) + 1;
      });

      const result = (data || []).map((barn: any) => ({
        ...barn,
        animal_count: countMap[barn.id] || 0,
      })) as Barn[];

      // 4. Update cache
      await updateBarnsCache(farmId, result);

      return result;
    },
    enabled: !!farmId,
  });
}

export function useBarnAnimals(barnId: string | null, farmId: string | null) {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: ['barn-animals', barnId],
    queryFn: async () => {
      if (!barnId || !farmId) return [];

      // 1. Check IndexedDB cache first
      const cached = await getCachedBarnAssignments(farmId);
      if (cached) {
        // Filter assignments for this barn that are active
        const barnAssignments = cached.assignments.filter(
          (a: any) => a.barn_id === barnId && !a.removed_at
        );

        // If we have cached data, resolve animal details from animals cache
        if (barnAssignments.length > 0) {
          const animalsCache = await getCachedAnimals(farmId);
          if (animalsCache) {
            const animalMap = new Map(animalsCache.data.map((a: any) => [a.id, a]));
            return barnAssignments.map((a: any) => ({
              ...a,
              animal: animalMap.get(a.animal_id) ? {
                id: a.animal_id,
                name: (animalMap.get(a.animal_id) as any)?.name || null,
                ear_tag: (animalMap.get(a.animal_id) as any)?.ear_tag || null,
                livestock_type: (animalMap.get(a.animal_id) as any)?.livestock_type || 'cattle',
                current_barn_id: (animalMap.get(a.animal_id) as any)?.current_barn_id || null,
              } : a.animal,
            })) as BarnAssignment[];
          }
          return barnAssignments as BarnAssignment[];
        }
      }

      // 2. If offline with no cache, return empty
      if (!isOnline) return [];

      // 3. Fetch from Supabase
      const { data, error } = await supabase
        .from('barn_assignments')
        .select(`
          id, barn_id, animal_id, assigned_at, removed_at, assigned_by, farm_id,
          animal:animals(id, name, ear_tag, livestock_type, current_barn_id)
        `)
        .eq('barn_id', barnId)
        .eq('farm_id', farmId)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      const result = (data || []) as unknown as BarnAssignment[];

      // 4. Update assignments cache (merge with existing)
      const existingCache = await getCachedBarnAssignments(farmId);
      const existingAssignments = existingCache?.assignments || [];
      // Remove old assignments for this barn, add fresh ones
      const otherBarnAssignments = existingAssignments.filter((a: any) => a.barn_id !== barnId);
      await updateBarnAssignmentsCache(farmId, [...otherBarnAssignments, ...result]);

      return result;
    },
    enabled: !!barnId && !!farmId,
  });
}

export function useCreateBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barn: { name: string; barn_type: string; description?: string; capacity?: number }) => {
      if (!farmId) throw new Error('No farm ID');

      if (getIsOnline()) {
        // Online path: direct insert
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('barns')
          .insert({
            farm_id: farmId,
            name: barn.name,
            barn_type: barn.barn_type,
            description: barn.description || null,
            capacity: barn.capacity || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Offline path: optimistic local update + queue
        const tempId = crypto.randomUUID();
        const optimisticBarn: Barn = {
          id: tempId,
          farm_id: farmId,
          name: barn.name,
          barn_type: barn.barn_type,
          description: barn.description || null,
          capacity: barn.capacity || null,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
          animal_count: 0,
        };

        // Add to local cache
        await updateLocalBarn(farmId, 'add', optimisticBarn);

        // Queue for sync
        await addToQueue({
          id: crypto.randomUUID(),
          type: 'barn_create',
          payload: {
            farmId,
            barnData: {
              name: barn.name,
              barn_type: barn.barn_type,
              description: barn.description || null,
              capacity: barn.capacity || null,
            },
            barnId: tempId,
          },
          createdAt: Date.now(),
        });

        return optimisticBarn;
      }
    },
    onSuccess: () => {
      if (farmId) {
        try { getCacheManager().invalidateForMutation('barn', farmId); } catch { /* not initialized */ }
        queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
      }
    },
  });
}

export function useUpdateBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; barn_type?: string; description?: string | null; capacity?: number | null; is_active?: boolean }) => {
      if (getIsOnline()) {
        const { error } = await supabase
          .from('barns')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      } else {
        // Offline: optimistic update + queue
        if (farmId) {
          await updateLocalBarn(farmId, 'update', { id, ...updates });
        }

        await addToQueue({
          id: crypto.randomUUID(),
          type: 'barn_update',
          payload: {
            farmId: farmId || '',
            barnId: id,
            barnData: {
              name: updates.name || '',
              barn_type: updates.barn_type || '',
              description: updates.description,
              capacity: updates.capacity,
            },
          },
          createdAt: Date.now(),
          clientTimestamp: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      if (farmId) {
        try { getCacheManager().invalidateForMutation('barn', farmId); } catch { /* not initialized */ }
        queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
      }
    },
  });
}

export function useAssignAnimalToBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ barnId, animalId }: { barnId: string; animalId: string }) => {
      if (!farmId) throw new Error('No farm ID');

      if (getIsOnline()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('barn_assignments')
          .insert({
            barn_id: barnId,
            animal_id: animalId,
            farm_id: farmId,
            assigned_by: user.id,
          });

        if (error) throw error;
      } else {
        // Offline: optimistic assignment
        const tempId = crypto.randomUUID();
        const assignment = {
          id: tempId,
          barn_id: barnId,
          animal_id: animalId,
          farm_id: farmId,
          assigned_at: new Date().toISOString(),
          removed_at: null,
          assigned_by: null,
        };

        await updateLocalBarnAssignment(farmId, 'add', assignment);
        await updateLocalBarn(farmId, 'increment_count', { id: barnId });
        await updateLocalAnimalBarn(farmId, animalId, barnId);

        await addToQueue({
          id: crypto.randomUUID(),
          type: 'barn_assign',
          payload: {
            farmId,
            barnId,
            barnAnimalId: animalId,
          },
          createdAt: Date.now(),
        });
      }
    },
    onSuccess: () => {
      if (farmId) {
        try { getCacheManager().invalidateForMutation('barn', farmId); } catch { /* not initialized */ }
        queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
        queryClient.invalidateQueries({ queryKey: ['barn-animals'] });
      }
    },
  });
}

export function useDeleteBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barnId: string) => {
      if (!farmId) throw new Error('No farm ID');

      if (getIsOnline()) {
        // Step 1: Clear active assignments (unassign all animals)
        const { error: assignError } = await supabase
          .from('barn_assignments')
          .update({ removed_at: new Date().toISOString() })
          .eq('barn_id', barnId)
          .eq('farm_id', farmId)
          .is('removed_at', null);

        if (assignError) throw assignError;

        // Step 2: Soft-delete the barn
        const { error } = await supabase
          .from('barns')
          .update({ is_active: false })
          .eq('id', barnId);

        if (error) throw error;
      } else {
        // Offline: optimistic updates + queue
        await updateLocalBarn(farmId, 'delete', { id: barnId });

        await addToQueue({
          id: crypto.randomUUID(),
          type: 'barn_delete',
          payload: {
            farmId,
            barnId,
          },
          createdAt: Date.now(),
        });
      }
    },
    onSuccess: () => {
      if (farmId) {
        try { getCacheManager().invalidateForMutation('barn', farmId); } catch { /* not initialized */ }
        queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
        queryClient.invalidateQueries({ queryKey: ['barn-animals'] });
      }
    },
  });
}

export function useRemoveAnimalFromBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, barnId, animalId }: { assignmentId: string; barnId?: string; animalId?: string }) => {
      if (getIsOnline()) {
        const { error } = await supabase
          .from('barn_assignments')
          .update({ removed_at: new Date().toISOString() })
          .eq('id', assignmentId);

        if (error) throw error;
      } else {
        // Offline: optimistic removal
        if (farmId) {
          await updateLocalBarnAssignment(farmId, 'remove', { id: assignmentId });
          if (barnId) await updateLocalBarn(farmId, 'decrement_count', { id: barnId });
          if (animalId) await updateLocalAnimalBarn(farmId, animalId, null);
        }

        await addToQueue({
          id: crypto.randomUUID(),
          type: 'barn_remove',
          payload: {
            farmId: farmId || '',
            barnAssignmentId: assignmentId,
          },
          createdAt: Date.now(),
        });
      }
    },
    onSuccess: () => {
      if (farmId) {
        try { getCacheManager().invalidateForMutation('barn', farmId); } catch { /* not initialized */ }
        queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
        queryClient.invalidateQueries({ queryKey: ['barn-animals'] });
      }
    },
  });
}
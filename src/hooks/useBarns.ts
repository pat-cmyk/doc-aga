import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  return useQuery({
    queryKey: ['barns', farmId],
    queryFn: async () => {
      if (!farmId) return [];

      const { data, error } = await supabase
        .from('barns')
        .select('*')
        .eq('farm_id', farmId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Get animal counts per barn
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

      return (data || []).map((barn: any) => ({
        ...barn,
        animal_count: countMap[barn.id] || 0,
      })) as Barn[];
    },
    enabled: !!farmId,
  });
}

export function useBarnAnimals(barnId: string | null, farmId: string | null) {
  return useQuery({
    queryKey: ['barn-animals', barnId],
    queryFn: async () => {
      if (!barnId || !farmId) return [];

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
      return (data || []) as unknown as BarnAssignment[];
    },
    enabled: !!barnId && !!farmId,
  });
}

export function useCreateBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (barn: { name: string; barn_type: string; description?: string; capacity?: number }) => {
      if (!farmId) throw new Error('No farm ID');

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
    },
  });
}

export function useUpdateBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; barn_type?: string; description?: string | null; capacity?: number | null; is_active?: boolean }) => {
      const { error } = await supabase
        .from('barns')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
    },
  });
}

export function useAssignAnimalToBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ barnId, animalId }: { barnId: string; animalId: string }) => {
      if (!farmId) throw new Error('No farm ID');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // The trigger handles closing old assignments automatically
      const { error } = await supabase
        .from('barn_assignments')
        .insert({
          barn_id: barnId,
          animal_id: animalId,
          farm_id: farmId,
          assigned_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: (_, { barnId }) => {
      queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
      queryClient.invalidateQueries({ queryKey: ['barn-animals', barnId] });
      queryClient.invalidateQueries({ queryKey: ['farm-animals', farmId] });
    },
  });
}

export function useRemoveAnimalFromBarn(farmId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { error } = await supabase
        .from('barn_assignments')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barns', farmId] });
      queryClient.invalidateQueries({ queryKey: ['barn-animals'] });
      queryClient.invalidateQueries({ queryKey: ['farm-animals', farmId] });
    },
  });
}

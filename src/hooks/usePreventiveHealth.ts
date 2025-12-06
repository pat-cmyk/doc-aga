import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PreventiveHealthSchedule {
  id: string;
  animal_id: string;
  farm_id: string;
  schedule_type: 'vaccination' | 'deworming';
  treatment_name: string;
  scheduled_date: string;
  completed_date: string | null;
  completed_by: string | null;
  next_due_date: string | null;
  recurring_interval_months: number | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'overdue' | 'skipped';
  created_at: string;
  updated_at: string;
}

export interface PreventiveHealthProtocol {
  id: string;
  livestock_type: 'cattle' | 'goat' | 'sheep' | 'carabao';
  treatment_type: 'vaccination' | 'deworming';
  treatment_name: string;
  treatment_name_tagalog: string | null;
  first_dose_age_months: number | null;
  recurring_interval_months: number | null;
  notes: string | null;
  is_mandatory: boolean;
  source: string;
}

export function usePreventiveHealthSchedules(animalId?: string, farmId?: string) {
  return useQuery({
    queryKey: ['preventive-health-schedules', animalId, farmId],
    queryFn: async () => {
      let query = supabase
        .from('preventive_health_schedules')
        .select('*')
        .order('scheduled_date', { ascending: true });

      if (animalId) {
        query = query.eq('animal_id', animalId);
      } else if (farmId) {
        query = query.eq('farm_id', farmId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PreventiveHealthSchedule[];
    },
    enabled: !!(animalId || farmId),
  });
}

export function usePreventiveHealthProtocols(livestockType?: string) {
  return useQuery({
    queryKey: ['preventive-health-protocols', livestockType],
    queryFn: async () => {
      let query = supabase
        .from('preventive_health_protocols')
        .select('*')
        .order('treatment_type', { ascending: true })
        .order('treatment_name', { ascending: true });

      if (livestockType) {
        query = query.eq('livestock_type', livestockType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PreventiveHealthProtocol[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (protocols rarely change)
  });
}

export function useAddPreventiveHealthSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: {
      animal_id: string;
      farm_id: string;
      schedule_type: 'vaccination' | 'deworming';
      treatment_name: string;
      scheduled_date: string;
      recurring_interval_months?: number | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('preventive_health_schedules')
        .insert({
          ...schedule,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['preventive-health-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast.success('Schedule added successfully');
    },
    onError: (error) => {
      console.error('Error adding schedule:', error);
      toast.error('Failed to add schedule');
    },
  });
}

export function useMarkScheduleComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      scheduleId, 
      completedDate,
      createNextSchedule,
    }: { 
      scheduleId: string; 
      completedDate: string;
      createNextSchedule?: boolean;
    }) => {
      // Get current schedule first
      const { data: currentSchedule, error: fetchError } = await supabase
        .from('preventive_health_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (fetchError) throw fetchError;

      // Update current schedule to completed
      const { error: updateError } = await supabase
        .from('preventive_health_schedules')
        .update({
          status: 'completed',
          completed_date: completedDate,
          completed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', scheduleId);

      if (updateError) throw updateError;

      // If recurring, create next schedule
      if (createNextSchedule && currentSchedule.recurring_interval_months) {
        const nextDate = new Date(completedDate);
        nextDate.setMonth(nextDate.getMonth() + currentSchedule.recurring_interval_months);

        const { error: insertError } = await supabase
          .from('preventive_health_schedules')
          .insert({
            animal_id: currentSchedule.animal_id,
            farm_id: currentSchedule.farm_id,
            schedule_type: currentSchedule.schedule_type,
            treatment_name: currentSchedule.treatment_name,
            scheduled_date: nextDate.toISOString().split('T')[0],
            recurring_interval_months: currentSchedule.recurring_interval_months,
            notes: currentSchedule.notes,
            status: 'scheduled',
          });

        if (insertError) throw insertError;
      }

      return currentSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-health-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast.success('Marked as complete');
    },
    onError: (error) => {
      console.error('Error completing schedule:', error);
      toast.error('Failed to mark as complete');
    },
  });
}

export function useSkipSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, reason }: { scheduleId: string; reason?: string }) => {
      const { error } = await supabase
        .from('preventive_health_schedules')
        .update({
          status: 'skipped',
          notes: reason,
        })
        .eq('id', scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-health-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast.success('Schedule skipped');
    },
    onError: (error) => {
      console.error('Error skipping schedule:', error);
      toast.error('Failed to skip schedule');
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('preventive_health_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preventive-health-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-alerts'] });
      toast.success('Schedule deleted');
    },
    onError: (error) => {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    },
  });
}

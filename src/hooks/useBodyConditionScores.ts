import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BodyConditionScore {
  id: string;
  animal_id: string;
  farm_id: string;
  score: number;
  assessment_date: string;
  assessor_id: string | null;
  photo_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateBCSData {
  animal_id: string;
  farm_id: string;
  score: number;
  assessment_date?: string;
  notes?: string;
}

export function useBodyConditionScores(animalId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bcsRecords = [], isLoading } = useQuery({
    queryKey: ['bcs-records', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_condition_scores')
        .select('*')
        .eq('animal_id', animalId)
        .order('assessment_date', { ascending: false });

      if (error) throw error;
      return data as BodyConditionScore[];
    },
    enabled: !!animalId,
  });

  const createBCS = useMutation({
    mutationFn: async (data: CreateBCSData) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('body_condition_scores').insert({
        animal_id: data.animal_id,
        farm_id: data.farm_id,
        score: data.score,
        assessment_date: data.assessment_date || new Date().toISOString().split('T')[0],
        assessor_id: userData?.user?.id,
        notes: data.notes,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bcs-records', animalId] });
      toast({
        title: 'BCS Recorded',
        description: 'Body condition score saved successfully.',
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

  const latestBCS = bcsRecords[0] || null;

  // Get BCS status indicator
  const getBCSStatus = (score: number) => {
    if (score < 2.0) return { status: 'critical', label: 'Underweight', color: 'text-destructive' };
    if (score < 2.5) return { status: 'warning', label: 'Thin', color: 'text-yellow-600' };
    if (score <= 3.5) return { status: 'good', label: 'Ideal', color: 'text-green-600' };
    if (score <= 4.0) return { status: 'warning', label: 'Overweight', color: 'text-yellow-600' };
    return { status: 'critical', label: 'Obese', color: 'text-destructive' };
  };

  return {
    bcsRecords,
    isLoading,
    createBCS,
    latestBCS,
    getBCSStatus,
  };
}

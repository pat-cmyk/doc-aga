import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FarmerFeedback {
  id: string;
  farm_id: string;
  user_id: string;
  voice_audio_url: string | null;
  transcription: string;
  ai_summary: string | null;
  primary_category: string;
  secondary_categories: string[] | null;
  tags: string[] | null;
  sentiment: string;
  priority_score: number;
  auto_priority: string;
  detected_entities: any;
  status: string;
  assigned_department: string | null;
  government_notes: string | null;
  action_taken: string | null;
  resolution_date: string | null;
  is_anonymous: boolean;
  farm_snapshot: any;
  created_at: string;
  updated_at: string;
  acknowledged_at: string | null;
  reviewed_at: string | null;
}

export const useFarmerFeedback = (farmId?: string) => {
  const queryClient = useQueryClient();

  const { data: feedbackList, isLoading } = useQuery({
    queryKey: ['farmer-feedback', farmId],
    queryFn: async () => {
      let query = supabase
        .from('farmer_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (farmId) {
        query = query.eq('farm_id', farmId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FarmerFeedback[];
    },
    enabled: !!farmId,
  });

  const submitFeedback = useMutation({
    mutationFn: async ({
      farmId,
      transcription,
      voiceAudioUrl,
      isAnonymous,
    }: {
      farmId: string;
      transcription: string;
      voiceAudioUrl?: string;
      isAnonymous: boolean;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get farm snapshot
      const { data: farm } = await supabase
        .from('farms')
        .select('name, region, province, municipality, livestock_type')
        .eq('id', farmId)
        .single();

      // Get animal count
      const { count: animalCount } = await supabase
        .from('animals')
        .select('*', { count: 'exact', head: true })
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      const farmSnapshot = {
        farm_name: farm?.name,
        location: `${farm?.municipality}, ${farm?.province}, ${farm?.region}`,
        livestock_type: farm?.livestock_type,
        animal_count: animalCount,
        timestamp: new Date().toISOString(),
      };

      // Process with AI
      const { data: aiAnalysis, error: aiError } = await supabase.functions.invoke('process-farmer-feedback', {
        body: { transcription, farmId },
      });

      if (aiError) throw aiError;

      // Insert feedback
      const { data, error } = await supabase
        .from('farmer_feedback')
        .insert({
          farm_id: farmId,
          user_id: user.id,
          transcription,
          voice_audio_url: voiceAudioUrl,
          ai_summary: aiAnalysis.analysis.summary,
          primary_category: aiAnalysis.analysis.primary_category,
          secondary_categories: aiAnalysis.analysis.secondary_categories,
          tags: aiAnalysis.analysis.tags,
          sentiment: aiAnalysis.analysis.sentiment,
          priority_score: aiAnalysis.analysis.priority_score,
          auto_priority: aiAnalysis.analysis.auto_priority,
          detected_entities: aiAnalysis.analysis.detected_entities,
          assigned_department: aiAnalysis.analysis.suggested_department,
          is_anonymous: isAnonymous,
          farm_snapshot: farmSnapshot,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer-feedback'] });
      toast.success('Naisumite na ang iyong feedback sa gobyerno');
    },
    onError: (error: Error) => {
      toast.error('Hindi nai-submit ang feedback: ' + error.message);
    },
  });

  return {
    feedbackList,
    isLoading,
    submitFeedback: submitFeedback.mutate,
    isSubmitting: submitFeedback.isPending,
  };
};

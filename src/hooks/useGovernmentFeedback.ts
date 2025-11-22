import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FeedbackStatus = 'submitted' | 'acknowledged' | 'under_review' | 'action_taken' | 'resolved' | 'closed';
type FeedbackCategory = 'policy_concern' | 'market_access' | 'veterinary_support' | 'training_request' | 'infrastructure' | 'financial_assistance' | 'emergency_support' | 'disease_outbreak' | 'feed_shortage';
type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low';

interface FeedbackFilters {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useGovernmentFeedback = (filters?: FeedbackFilters) => {
  const queryClient = useQueryClient();

  const { data: feedbackList, isLoading } = useQuery({
    queryKey: ['government-feedback', filters],
    queryFn: async () => {
      let query = supabase
        .from('farmer_feedback')
        .select(`
          *,
          farms!inner(name, region, province, municipality, livestock_type)
        `)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('primary_category', filters.category);
      }
      if (filters?.priority) {
        query = query.eq('auto_priority', filters.priority);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by region if specified
      if (filters?.region) {
        return data.filter((item: any) => item.farms.region === filters.region);
      }

      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['government-feedback-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farmer_feedback')
        .select('status, auto_priority, primary_category, created_at');

      if (error) throw error;

      const total = data.length;
      const pending = data.filter(f => f.status === 'submitted').length;
      const critical = data.filter(f => f.auto_priority === 'critical').length;
      
      // Category distribution
      const categoryCount: Record<string, number> = {};
      data.forEach(f => {
        categoryCount[f.primary_category] = (categoryCount[f.primary_category] || 0) + 1;
      });

      // Recent submissions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recent = data.filter(f => new Date(f.created_at) >= sevenDaysAgo).length;

      return {
        total,
        pending,
        critical,
        categoryCount,
        recent,
      };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      feedbackId,
      status,
      notes,
      actionTaken,
      assignedDepartment,
    }: {
      feedbackId: string;
      status: string;
      notes?: string;
      actionTaken?: string;
      assignedDepartment?: string;
    }) => {
      const updates: any = { status };
      
      if (notes) updates.government_notes = notes;
      if (actionTaken) updates.action_taken = actionTaken;
      if (assignedDepartment) updates.assigned_department = assignedDepartment;
      
      if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'under_review') {
        updates.reviewed_at = new Date().toISOString();
      } else if (status === 'resolved' || status === 'closed') {
        updates.resolution_date = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('farmer_feedback')
        .update(updates)
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['government-feedback-stats'] });
      toast.success('Feedback status updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  return {
    feedbackList,
    stats,
    isLoading,
    updateStatus: updateStatus.mutate,
    isUpdating: updateStatus.isPending,
  };
};

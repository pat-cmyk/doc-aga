import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export interface PendingActivity {
  id: string;
  farm_id: string;
  submitted_by: string;
  activity_type: 'milking' | 'feeding' | 'health_observation' | 'weight_measurement' | 'injection';
  activity_data: any;
  animal_ids: string[];
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  submitted_at: string;
  auto_approve_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  submitter?: {
    full_name: string;
    email: string;
  };
}

export const usePendingActivities = (farmId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!farmId && !userId) return;

    const channel = supabase
      .channel('pending-activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_activities',
          filter: farmId ? `farm_id=eq.${farmId}` : userId ? `submitted_by=eq.${userId}` : undefined,
        },
        (payload) => {
          console.log('Pending activity changed:', payload);
          
          // Invalidate and refetch
          queryClient.invalidateQueries({ queryKey: ['pending-activities', farmId, userId] });
          
          // Show toast notifications based on event type
          if (payload.eventType === 'INSERT' && farmId && !userId) {
            // Manager view: new submission arrived
            toast.info('New Activity Submitted', {
              description: 'A farmhand has submitted a new activity for review.',
            });
          } else if (payload.eventType === 'UPDATE' && userId && !farmId) {
            // Farmhand view: status changed
            const newRecord = payload.new as any;
            if (newRecord.status === 'approved') {
              toast.success('Activity Approved', {
                description: 'Your submission has been approved by a manager.',
              });
            } else if (newRecord.status === 'auto_approved') {
              toast.success('Activity Auto-Approved', {
                description: 'Your submission has been automatically approved.',
              });
            } else if (newRecord.status === 'rejected') {
              toast.error('Activity Rejected', {
                description: newRecord.rejection_reason || 'Your submission has been rejected.',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId, userId, queryClient]);

  const { data: activities, isLoading } = useQuery({
    queryKey: ['pending-activities', farmId, userId],
    queryFn: async () => {
      let query = supabase
        .from('pending_activities')
        .select(`
          *,
          submitter:profiles!fk_pending_activities_submitted_by_profiles(full_name, email)
        `)
        .order('submitted_at', { ascending: false });

      if (farmId) {
        query = query.eq('farm_id', farmId);
      }

      if (userId) {
        query = query.eq('submitted_by', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to match our interface
      return (data || []).map(item => ({
        ...item,
        submitter: item.submitter ? {
          full_name: (item.submitter as any).full_name || 'Unknown',
          email: (item.submitter as any).email || ''
        } : undefined
      })) as PendingActivity[];
    },
    enabled: !!farmId || !!userId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ 
      pendingId, 
      action, 
      rejectionReason 
    }: { 
      pendingId: string; 
      action: 'approve' | 'reject'; 
      rejectionReason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('review-pending-activity', {
        body: { pendingId, action, rejectionReason }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] });
      
      const action = variables.action === 'approve' ? 'approved' : 'rejected';
      toast.success(`Activity ${action} successfully`);
    },
    onError: (error) => {
      console.error('Review error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to review activity');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (pendingId: string) => {
      const { error } = await supabase
        .from('pending_activities')
        .delete()
        .eq('id', pendingId)
        .eq('status', 'pending');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] });
      toast.success('Submission deleted successfully');
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete submission');
    },
  });

  const pendingCount = activities?.filter(a => a.status === 'pending').length || 0;
  const approvedCount = activities?.filter(a => ['approved', 'auto_approved'].includes(a.status)).length || 0;
  const rejectedCount = activities?.filter(a => a.status === 'rejected').length || 0;

  return {
    activities: activities || [],
    isLoading,
    pendingCount,
    approvedCount,
    rejectedCount,
    approveActivity: (pendingId: string) => reviewMutation.mutate({ pendingId, action: 'approve' }),
    rejectActivity: (pendingId: string, rejectionReason: string) => 
      reviewMutation.mutate({ pendingId, action: 'reject', rejectionReason }),
    isReviewing: reviewMutation.isPending,
    deleteActivity: (pendingId: string) => deleteMutation.mutate(pendingId),
    isDeleting: deleteMutation.isPending,
  };
};

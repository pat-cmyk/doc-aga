/**
 * @cache-status MANUAL — Government-scoped, cross-farm, @online-only. CacheManager not applicable.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorHandling";
import { DataCategory } from "@/types/government";

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
  dataCategory?: DataCategory;
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
          farms!inner(name, region, province, municipality, livestock_type, data_category)
        `)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply data category filter at query level (SSOT pattern)
      if (filters?.dataCategory && filters.dataCategory !== 'all') {
        query = query.eq('farms.data_category', filters.dataCategory);
      }

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
        // Append end-of-day time when bare date string (e.g. "2026-03-11") is compared
        // against timestamptz — otherwise records created during that day are excluded
        const endOfDay = filters.dateTo.includes('T')
          ? filters.dateTo
          : `${filters.dateTo}T23:59:59.999`;
        query = query.lte('created_at', endOfDay);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      console.log('[useGovernmentFeedback] Loaded feedback rows:', data?.length);

      // Client-side filtering for region (different pattern)
      let filtered = data;
      if (filters?.region) {
        filtered = filtered.filter((item: any) => item.farms?.region === filters.region);
      }

      return filtered;
    },
  });

  // Derive stats from the already-fetched feedbackList (same data, zero extra API calls).
  // Previously a separate query that ignored dateFrom/dateTo/region filters — bug fix.
  const stats = useMemo(() => {
    if (!feedbackList || feedbackList.length === 0) return null;

    const total = feedbackList.length;
    const pending = feedbackList.filter((f: any) => f.status === 'submitted').length;
    const critical = feedbackList.filter((f: any) => f.auto_priority === 'critical').length;

    const categoryCount: Record<string, number> = {};
    feedbackList.forEach((f: any) => {
      categoryCount[f.primary_category] = (categoryCount[f.primary_category] || 0) + 1;
    });

    // Recent submissions (last 7 days from today, within the already-filtered dataset)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = feedbackList.filter((f: any) => new Date(f.created_at) >= sevenDaysAgo).length;

    return { total, pending, critical, categoryCount, recent };
  }, [feedbackList]);

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
      toast.success('Feedback status updated');
    },
    onError: (error: Error) => {
      showErrorToast(error, "updating feedback status");
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

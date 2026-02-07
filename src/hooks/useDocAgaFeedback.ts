import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type FeedbackRating = 'positive' | 'negative';

interface UseDocAgaFeedbackOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useDocAgaFeedback = (options?: UseDocAgaFeedbackOptions) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const submitFeedback = async (
    queryId: string, 
    rating: FeedbackRating,
    comment?: string
  ): Promise<boolean> => {
    if (!queryId) {
      console.error('[useDocAgaFeedback] No queryId provided');
      return false;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('doc_aga_queries')
        .update({
          feedback_rating: rating,
          feedback_comment: comment || null,
          feedback_at: new Date().toISOString()
        })
        .eq('id', queryId);
      
      if (error) {
        console.error('[useDocAgaFeedback] Failed to submit feedback:', error);
        throw error;
      }

      console.log('[useDocAgaFeedback] Feedback submitted successfully:', { queryId, rating });
      
      options?.onSuccess?.();
      return true;
    } catch (error: any) {
      console.error('[useDocAgaFeedback] Error:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
      options?.onError?.(error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFeedback = async (queryId: string): Promise<boolean> => {
    if (!queryId) return false;

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('doc_aga_queries')
        .update({
          feedback_rating: null,
          feedback_comment: null,
          feedback_at: null
        })
        .eq('id', queryId);
      
      if (error) throw error;
      
      console.log('[useDocAgaFeedback] Feedback cleared:', queryId);
      return true;
    } catch (error: any) {
      console.error('[useDocAgaFeedback] Clear error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { 
    submitFeedback, 
    clearFeedback,
    isSubmitting 
  };
};

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useDocAgaFeedback, FeedbackRating } from "@/hooks/useDocAgaFeedback";
import { cn } from "@/lib/utils";

interface DocAgaFeedbackButtonsProps {
  queryId: string;
  initialRating?: FeedbackRating | null;
  onFeedbackSubmitted?: (rating: FeedbackRating) => void;
}

export const DocAgaFeedbackButtons = ({
  queryId,
  initialRating,
  onFeedbackSubmitted
}: DocAgaFeedbackButtonsProps) => {
  const [currentRating, setCurrentRating] = useState<FeedbackRating | null>(initialRating || null);
  const { submitFeedback, isSubmitting } = useDocAgaFeedback();

  const handleFeedback = async (rating: FeedbackRating) => {
    // If clicking the same rating, don't toggle off (keep it selected)
    if (currentRating === rating) return;

    const success = await submitFeedback(queryId, rating);
    if (success) {
      setCurrentRating(rating);
      onFeedbackSubmitted?.(rating);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
      <span className="text-xs text-muted-foreground mr-2">Nakatulong ba?</span>
      
      <Button
        size="sm"
        variant={currentRating === 'positive' ? 'default' : 'ghost'}
        className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]"
        onClick={() => handleFeedback('positive')}
        disabled={isSubmitting}
        aria-label="Helpful"
      >
        {isSubmitting && currentRating !== 'positive' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ThumbsUp className={cn(
            "h-4 w-4",
            currentRating === 'positive' && "fill-current"
          )} />
        )}
      </Button>
      
      <Button
        size="sm"
        variant={currentRating === 'negative' ? 'destructive' : 'ghost'}
        className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]" // 44px touch target
        onClick={() => handleFeedback('negative')}
        disabled={isSubmitting}
        aria-label="Not helpful"
      >
        {isSubmitting && currentRating !== 'negative' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ThumbsDown className={cn(
            "h-4 w-4",
            currentRating === 'negative' && "fill-current"
          )} />
        )}
      </Button>
    </div>
  );
};

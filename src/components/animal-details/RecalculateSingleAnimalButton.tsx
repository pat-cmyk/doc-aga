import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminAccess } from "@/hooks/useAdminAccess";

interface RecalculateSingleAnimalButtonProps {
  animalId: string;
  onSuccess?: () => void;
}

export const RecalculateSingleAnimalButton = ({ 
  animalId, 
  onSuccess 
}: RecalculateSingleAnimalButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { isAdmin } = useAdminAccess();

  if (!isAdmin) return null;

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-animal', {
        body: { animalId }
      });

      if (error) {
        if (error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          toast({
            title: "Authentication Error",
            description: "You need admin privileges to perform this action.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      if (data?.success && data?.animal) {
        toast({
          title: "Recalculated Successfully",
          description: `Life Stage: ${data.animal.old_life_stage || 'N/A'} → ${data.animal.new_life_stage || 'N/A'}`,
        });
        onSuccess?.();
      } else if (data?.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error recalculating animal:", error);
      toast({
        title: "Error",
        description: "Failed to recalculate this animal's life stage.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleRecalculate} 
      disabled={isLoading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Recalculating..." : "Recalculate Stages"}
    </Button>
  );
};

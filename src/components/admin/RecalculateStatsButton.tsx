import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const RecalculateStatsButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-daily-stats', {
        method: 'POST'
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Animal life stages have been recalculated successfully.",
      });
    } catch (error) {
      console.error("Error recalculating stats:", error);
      toast({
        title: "Error",
        description: "Failed to recalculate animal life stages. Please try again.",
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
      className="w-full"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Recalculating..." : "Recalculate Animal Life Stages"}
    </Button>
  );
};

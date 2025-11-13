import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const RecalculateStatsButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const handleRecalculate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-daily-stats', {
        method: 'POST'
      });

      if (error) {
        // Handle auth errors specifically
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

      toast({
        title: "Success",
        description: "Animal life stages have been recalculated successfully.",
      });
      
      setShowDialog(true);
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

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      setSearchResult("Please enter an animal code");
      return;
    }

    try {
      const { data: animal, error } = await supabase
        .from('animals')
        .select('unique_code, life_stage, milking_stage')
        .eq('unique_code', searchCode.trim())
        .single();

      if (error || !animal) {
        setSearchResult(`Animal ${searchCode} not found`);
        return;
      }

      setSearchResult(
        `${animal.unique_code}:\nLife Stage: ${animal.life_stage || 'N/A'}\nMilking Stage: ${animal.milking_stage || 'N/A'}`
      );
    } catch (err) {
      setSearchResult("Error searching for animal");
    }
  };

  return (
    <>
      <Button 
        onClick={handleRecalculate} 
        disabled={isLoading}
        className="w-full"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? "Recalculating..." : "Recalculate Animal Life Stages"}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculation Complete</DialogTitle>
            <DialogDescription>
              All animal life stages have been recalculated. You can verify a specific animal below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-code">Search Animal by Code</Label>
              <Input
                id="search-code"
                placeholder="e.g., RUM-2511-00000024"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} className="w-full">
              Search
            </Button>
            {searchResult && (
              <div className="p-3 bg-muted rounded-md">
                <pre className="text-sm whitespace-pre-wrap">{searchResult}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

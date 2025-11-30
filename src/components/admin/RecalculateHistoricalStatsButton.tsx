import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const RecalculateHistoricalStatsButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleRecalculate = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please provide both start and end dates.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Validation Error",
        description: "Start date must be before end date.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-daily-stats', {
        method: 'POST',
        body: {
          start_date: startDate,
          end_date: endDate,
        }
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

      toast({
        title: "Success",
        description: `Historical stats recalculated from ${startDate} to ${endDate}.`,
      });
      
      setShowDialog(false);
    } catch (error) {
      console.error("Error recalculating historical stats:", error);
      toast({
        title: "Error",
        description: "Failed to recalculate historical stats. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowDialog(true)} 
        variant="outline"
        className="w-full"
      >
        <Calendar className="h-4 w-4 mr-2" />
        Recalculate Historical Stats
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate Historical Stats</DialogTitle>
            <DialogDescription>
              Recalculate daily farm statistics for a custom date range. This will update existing records with corrected data based on animal registration dates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecalculate}
              disabled={isLoading}
            >
              {isLoading ? "Recalculating..." : "Recalculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
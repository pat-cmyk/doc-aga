import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Milk, Scale, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLactatingAnimals,
  getAnimalDropdownOptions,
  getSelectedAnimals,
} from "@/hooks/useLactatingAnimals";
import { calculateMilkSplit, MilkSplitResult } from "@/lib/milkSplitCalculation";

interface RecordBulkMilkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string | null;
}

export function RecordBulkMilkDialog({
  open,
  onOpenChange,
  farmId,
}: RecordBulkMilkDialogProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [totalLiters, setTotalLiters] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: animals = [], isLoading } = useLactatingAnimals(farmId);
  const dropdownOptions = useMemo(() => getAnimalDropdownOptions(animals), [animals]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOption("");
      setTotalLiters("");
    }
  }, [open]);

  const selectedAnimals = useMemo(
    () => getSelectedAnimals(animals, selectedOption),
    [animals, selectedOption]
  );

  const splitPreview = useMemo(() => {
    const liters = parseFloat(totalLiters);
    if (!selectedAnimals.length || isNaN(liters) || liters <= 0) {
      return [];
    }
    return calculateMilkSplit(selectedAnimals, liters);
  }, [selectedAnimals, totalLiters]);

  const handleSubmit = async () => {
    if (!farmId || splitPreview.length === 0) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];

      // Create milking records for each animal
      const records = splitPreview.map((split) => ({
        animal_id: split.animalId,
        record_date: today,
        liters: split.liters,
        created_by: user?.id,
        is_sold: false,
      }));

      const { error } = await supabase.from("milking_records").insert(records);

      if (error) throw error;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["milking-records"] });
      queryClient.invalidateQueries({ queryKey: ["milk-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      toast({
        title: "Milk Recorded",
        description: `${totalLiters}L split across ${splitPreview.length} animal${splitPreview.length > 1 ? "s" : ""}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording milk:", error);
      toast({
        title: "Error",
        description: "Failed to record milk production",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedAnimals.length > 0 && parseFloat(totalLiters) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Milk className="h-5 w-5 text-blue-500" />
            Record Milk Production
          </DialogTitle>
          <DialogDescription>
            Record milk collected and split proportionally by weight and lactation stage
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : animals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Milk className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No lactating animals in your herd</p>
            <p className="text-sm mt-1">
              Animals must be in Early, Mid, or Late Lactation stage
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Animal Selection */}
            <div className="space-y-2">
              <Label htmlFor="animal-select">Select Animals</Label>
              <Select value={selectedOption} onValueChange={setSelectedOption}>
                <SelectTrigger id="animal-select" className="min-h-[48px]">
                  <SelectValue placeholder="Choose animals..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {dropdownOptions.map((opt) =>
                    opt.value === "__separator__" ? (
                      <div
                        key={opt.value}
                        className="text-xs text-muted-foreground px-2 py-1"
                      >
                        Individual Animals
                      </div>
                    ) : (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Total Liters */}
            <div className="space-y-2">
              <Label htmlFor="total-liters">Total Liters Collected</Label>
              <Input
                id="total-liters"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 25.5"
                value={totalLiters}
                onChange={(e) => setTotalLiters(e.target.value)}
                className="min-h-[48px]"
              />
            </div>

            {/* Split Preview */}
            {splitPreview.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Split Preview
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {splitPreview.map((split) => (
                    <SplitPreviewRow key={split.animalId} split={split} />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 min-h-[48px]"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 min-h-[48px]"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  "Record Milk"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SplitPreviewRow({ split }: { split: MilkSplitResult }) {
  return (
    <div className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{split.animalName}</span>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Scale className="h-3 w-3" />
          {split.weight}kg
        </span>
      </div>
      <span className="font-semibold text-blue-600 shrink-0 ml-2">
        {split.liters.toFixed(1)}L
      </span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { format, parseISO, addDays, subDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Droplets, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AnimalMilkRecord {
  animalId: string;
  animalName: string | null;
  earTag: string | null;
  liters: number;
  isSold: boolean;
  saleAmount: number | null;
}

interface MilkDayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  date: string; // YYYY-MM-DD format
  minDate?: string;
  maxDate?: string;
  onDateChange: (newDate: string) => void;
}

export const MilkDayDetailDialog = ({
  open,
  onOpenChange,
  farmId,
  date,
  minDate,
  maxDate,
  onDateChange,
}: MilkDayDetailDialogProps) => {
  const [records, setRecords] = useState<AnimalMilkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMilk, setTotalMilk] = useState(0);

  useEffect(() => {
    if (!open || !date || !farmId) return;

    const fetchDayDetails = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("milking_records")
          .select(`
            liters,
            is_sold,
            sale_amount,
            animals!inner(
              id,
              name,
              ear_tag,
              farm_id
            )
          `)
          .eq("animals.farm_id", farmId)
          .eq("record_date", date);

        if (error) throw error;

        const animalRecords: Record<string, AnimalMilkRecord> = {};
        
        data?.forEach((record: any) => {
          const animalId = record.animals.id;
          if (!animalRecords[animalId]) {
            animalRecords[animalId] = {
              animalId,
              animalName: record.animals.name,
              earTag: record.animals.ear_tag,
              liters: 0,
              isSold: false,
              saleAmount: 0,
            };
          }
          animalRecords[animalId].liters += Number(record.liters);
          if (record.is_sold) {
            animalRecords[animalId].isSold = true;
            animalRecords[animalId].saleAmount = (animalRecords[animalId].saleAmount || 0) + (record.sale_amount || 0);
          }
        });

        const recordsList = Object.values(animalRecords).sort((a, b) => b.liters - a.liters);
        setRecords(recordsList);
        setTotalMilk(recordsList.reduce((sum, r) => sum + r.liters, 0));
      } catch (error) {
        console.error("Error fetching day details:", error);
        setRecords([]);
        setTotalMilk(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDayDetails();
  }, [open, date, farmId]);

  const handlePrevDay = () => {
    const newDate = format(subDays(parseISO(date), 1), "yyyy-MM-dd");
    if (!minDate || newDate >= minDate) {
      onDateChange(newDate);
    }
  };

  const handleNextDay = () => {
    const newDate = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
    if (!maxDate || newDate <= maxDate) {
      onDateChange(newDate);
    }
  };

  const canGoPrev = !minDate || date > minDate;
  const canGoNext = !maxDate || date < maxDate;

  let formattedDate = date;
  try {
    formattedDate = format(parseISO(date), "EEEE, MMMM d, yyyy");
  } catch {
    // Keep original format
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-chart-1" />
            Milk Production Details
          </DialogTitle>
        </DialogHeader>

        {/* Date Navigation */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{formattedDate}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Production</p>
            <p className="text-2xl font-bold text-foreground">{totalMilk.toFixed(1)} L</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Animals</p>
            <p className="text-2xl font-bold text-foreground">{records.length}</p>
          </div>
        </div>

        {/* Animal Breakdown */}
        <ScrollArea className="max-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No milk records for this day
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const percentage = totalMilk > 0 ? (record.liters / totalMilk) * 100 : 0;
                return (
                  <div key={record.animalId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {record.animalName || record.earTag || "Unknown"}
                        {record.earTag && record.animalName && (
                          <span className="text-muted-foreground ml-1">({record.earTag})</span>
                        )}
                      </span>
                      <span className="font-semibold text-foreground">
                        {record.liters.toFixed(1)} L
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    {record.isSold && record.saleAmount && record.saleAmount > 0 && (
                      <p className="text-xs text-green-500">
                        Sold: ₱{record.saleAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

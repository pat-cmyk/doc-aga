import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown, LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface HeadcountMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  month: string;
  stageData: Record<string, number>;
  onNavigate: (direction: "prev" | "next") => void;
  hasPrev: boolean;
  hasNext: boolean;
  stageCategories: {
    productive: string[];
    development: string[];
    breeding: string[];
  };
}

interface AnimalSnapshot {
  id: string;
  name: string | null;
  ear_tag: string | null;
  life_stage: string | null;
}

interface MonthEvents {
  births: number;
  exits: number;
  exitsByReason: Record<string, number>;
}

export const HeadcountMonthDialog = ({
  open,
  onOpenChange,
  farmId,
  month,
  stageData,
  onNavigate,
  hasPrev,
  hasNext,
  stageCategories
}: HeadcountMonthDialogProps) => {
  const [animals, setAnimals] = useState<AnimalSnapshot[]>([]);
  const [events, setEvents] = useState<MonthEvents>({ births: 0, exits: 0, exitsByReason: {} });
  const [loading, setLoading] = useState(false);

  // Parse month string to get date range
  const getMonthDateRange = (monthStr: string) => {
    const date = new Date(monthStr);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0]
    };
  };

  useEffect(() => {
    if (!open || !month) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const { start, end } = getMonthDateRange(month);

        // Fetch animals that existed during this month
        const { data: animalsData } = await supabase
          .from("animals")
          .select("id, name, ear_tag, life_stage, created_at, exit_date, exit_reason")
          .eq("farm_id", farmId)
          .lte("created_at", end + "T23:59:59")
          .or(`exit_date.is.null,exit_date.gte.${start}`)
          .eq("is_deleted", false)
          .order("life_stage");

        setAnimals(animalsData || []);

        // Count births (animals created in this month)
        const births = (animalsData || []).filter(a => {
          const createdDate = a.created_at?.split("T")[0];
          return createdDate && createdDate >= start && createdDate <= end;
        }).length;

        // Count exits in this month
        const exitsInMonth = (animalsData || []).filter(a => {
          return a.exit_date && a.exit_date >= start && a.exit_date <= end;
        });

        const exitsByReason: Record<string, number> = {};
        exitsInMonth.forEach(a => {
          const reason = a.exit_reason || "Unknown";
          exitsByReason[reason] = (exitsByReason[reason] || 0) + 1;
        });

        setEvents({
          births,
          exits: exitsInMonth.length,
          exitsByReason
        });
      } catch (error) {
        console.error("Error fetching month details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, month, farmId]);

  // Group animals by category
  const groupedAnimals = {
    productive: animals.filter(a => a.life_stage && stageCategories.productive.includes(a.life_stage)),
    development: animals.filter(a => a.life_stage && stageCategories.development.includes(a.life_stage)),
    breeding: animals.filter(a => a.life_stage && stageCategories.breeding.includes(a.life_stage))
  };

  const totalHeadcount = Object.values(stageData).reduce((sum, count) => sum + (count || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("prev")}
              disabled={!hasPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-center">{month}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("next")}
              disabled={!hasNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 p-1">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{totalHeadcount}</p>
                <p className="text-xs text-muted-foreground">Total Head</p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <LogIn className="h-5 w-5 mx-auto mb-1 text-green-600" />
                <p className="text-2xl font-bold text-green-600">{events.births}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 text-center">
                <LogOut className="h-5 w-5 mx-auto mb-1 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{events.exits}</p>
                <p className="text-xs text-muted-foreground">Exits</p>
              </div>
            </div>

            {/* Exit breakdown */}
            {events.exits > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Exit Reasons</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(events.exitsByReason).map(([reason, count]) => (
                    <Badge key={reason} variant="secondary" className="text-xs">
                      {reason}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Stage breakdown */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Headcount by Stage</p>
              
              {Object.entries(stageData)
                .filter(([_, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([stage, count]) => {
                  const percentage = totalHeadcount > 0 
                    ? ((count / totalHeadcount) * 100).toFixed(0)
                    : 0;
                  
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{stage}</span>
                        <span className="font-medium">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Category breakdown */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-medium">By Category</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-blue-500/10 rounded p-2">
                  <p className="font-bold text-blue-600">{groupedAnimals.productive.length}</p>
                  <p className="text-xs text-muted-foreground">Productive</p>
                </div>
                <div className="bg-amber-500/10 rounded p-2">
                  <p className="font-bold text-amber-600">{groupedAnimals.development.length}</p>
                  <p className="text-xs text-muted-foreground">Development</p>
                </div>
                <div className="bg-purple-500/10 rounded p-2">
                  <p className="font-bold text-purple-600">{groupedAnimals.breeding.length}</p>
                  <p className="text-xs text-muted-foreground">Breeding</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown, Minus, LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface HeadcountMonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  month: string;
  stageData: Record<string, number>;
  previousTotal: number | null;
  onNavigate: (direction: "prev" | "next") => void;
  hasPrev: boolean;
  hasNext: boolean;
  stageCategories: {
    productive: string[];
    development: string[];
    breeding: string[];
  };
}

interface MonthExits {
  exits: number;
  exitsByReason: Record<string, number>;
}

export const HeadcountMonthDialog = ({
  open,
  onOpenChange,
  farmId,
  month,
  stageData,
  previousTotal,
  onNavigate,
  hasPrev,
  hasNext,
  stageCategories
}: HeadcountMonthDialogProps) => {
  const [events, setEvents] = useState<MonthExits>({ exits: 0, exitsByReason: {} });
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

        // Fetch animals that exited during this month (for exit breakdown).
        // Omit is_deleted filter: exited animals are often also soft-deleted,
        // so filtering on is_deleted=false would miss real exits.
        const { data: exitedAnimals } = await supabase
          .from("animals")
          .select("id, exit_date, exit_reason")
          .eq("farm_id", farmId)
          .gte("exit_date", start)
          .lte("exit_date", end);

        const exitsByReason: Record<string, number> = {};
        (exitedAnimals || []).forEach(a => {
          const reason = a.exit_reason || "Unknown";
          exitsByReason[reason] = (exitsByReason[reason] || 0) + 1;
        });

        setEvents({
          exits: exitedAnimals?.length || 0,
          exitsByReason
        });
      } catch (error) {
        console.error("Error fetching month details:", error);
        // Graceful fallback — show 0 exits if query fails
        setEvents({ exits: 0, exitsByReason: {} });
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, month, farmId]);

  // Total headcount from stageData (SSOT — matches chart bar)
  const totalHeadcount = Object.values(stageData).reduce((sum, count) => sum + (count || 0), 0);

  // Derive reconciling herd flow numbers
  const prevTotal = previousTotal ?? 0;
  const netChange = totalHeadcount - prevTotal;
  // entered = how many joined the herd (always >= 0, reconciles with formula)
  // Formula: previous + entered - exited + adjustments = current
  const rawEntered = netChange + events.exits;
  const entered = Math.max(0, rawEntered);
  const adjustments = rawEntered < 0 ? rawEntered : 0;

  // Category breakdown from stageData (SSOT — matches chart categories)
  const categoryBreakdown = useMemo(() => {
    const productive = Object.entries(stageData)
      .filter(([stage]) => stageCategories.productive.includes(stage))
      .reduce((sum, [, count]) => sum + count, 0);
    const development = Object.entries(stageData)
      .filter(([stage]) => stageCategories.development.includes(stage))
      .reduce((sum, [, count]) => sum + count, 0);
    const breeding = Object.entries(stageData)
      .filter(([stage]) => stageCategories.breeding.includes(stage))
      .reduce((sum, [, count]) => sum + count, 0);
    const other = totalHeadcount - productive - development - breeding;
    return { productive, development, breeding, other };
  }, [stageData, stageCategories, totalHeadcount]);

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
                <p className="text-2xl font-bold text-green-600">{entered}</p>
                <p className="text-xs text-muted-foreground">Entered</p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-3 text-center">
                <LogOut className="h-5 w-5 mx-auto mb-1 text-red-600" />
                <p className="text-2xl font-bold text-red-600">{events.exits}</p>
                <p className="text-xs text-muted-foreground">Exits</p>
              </div>
            </div>

            {/* Herd Flow — reconcilable math */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
              <p className="font-medium mb-2">Herd Flow</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous month:</span>
                <span className="font-medium">{prevTotal}</span>
              </div>
              {entered > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>+ Pumasok (Entered):</span>
                  <span>+{entered}</span>
                </div>
              )}
              {events.exits > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>- Lumabas (Exited):</span>
                  <span>-{events.exits}</span>
                </div>
              )}
              {adjustments !== 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>± Data corrections:</span>
                  <span>{adjustments}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1.5 mt-1.5">
                <span>= This month:</span>
                <span>{totalHeadcount}</span>
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

            {/* Category breakdown — derived from stageData (SSOT) */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-medium">By Category</p>
              <div className={`grid ${categoryBreakdown.other > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center text-sm`}>
                <div className="bg-blue-500/10 rounded p-2">
                  <p className="font-bold text-blue-600">{categoryBreakdown.productive}</p>
                  <p className="text-xs text-muted-foreground">Productive</p>
                </div>
                <div className="bg-amber-500/10 rounded p-2">
                  <p className="font-bold text-amber-600">{categoryBreakdown.development}</p>
                  <p className="text-xs text-muted-foreground">Development</p>
                </div>
                <div className="bg-purple-500/10 rounded p-2">
                  <p className="font-bold text-purple-600">{categoryBreakdown.breeding}</p>
                  <p className="text-xs text-muted-foreground">Breeding</p>
                </div>
                {categoryBreakdown.other > 0 && (
                  <div className="bg-gray-500/10 rounded p-2">
                    <p className="font-bold text-gray-600">{categoryBreakdown.other}</p>
                    <p className="text-xs text-muted-foreground">Other</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

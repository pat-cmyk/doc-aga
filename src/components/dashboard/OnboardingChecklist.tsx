import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useRecordingFlows } from "@/components/shell/RecordingFlowsProvider";
import { REVENUE_SOURCE_KEYS } from "@/lib/revenueCategories";

/** Farms created before this date won't see the onboarding checklist */
const FEATURE_DEPLOY_DATE = "2026-03-10";

/** Farm-scoped localStorage helpers */
const dismissedKey = (farmId: string) => `onboarding_checklist_dismissed_${farmId}`;
const visitedMilkKey = (farmId: string) => `onboarding_visited_milk_tab_${farmId}`;
const visitedFinanceKey = (farmId: string) => `onboarding_visited_finance_${farmId}`;

interface OnboardingChecklistProps {
  farmId: string;
  /** Pass from parent to avoid extra query */
  totalAnimals?: number;
}

interface ChecklistStep {
  id: string;
  label: string;
  sublabel: string;
  done: boolean;
  action: () => void;
}

export function OnboardingChecklist({ farmId, totalAnimals }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { openBulkRecording } = useRecordingFlows();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissedKey(farmId)) === "true");
  const [hasMilkingRecords, setHasMilkingRecords] = useState<boolean | null>(null);
  const [hasMilkSale, setHasMilkSale] = useState<boolean | null>(null);
  const [animalCount, setAnimalCount] = useState<number>(totalAnimals ?? 0);

  // Track tab visits (farm-scoped)
  const visitedMilkTab = localStorage.getItem(visitedMilkKey(farmId)) === "true";
  const visitedFinance = localStorage.getItem(visitedFinanceKey(farmId)) === "true";

  // Fetch data + new-farm check on mount
  useEffect(() => {
    if (dismissed) return;

    const fetchProgress = async () => {
      // Gate: only show for farms created after feature deployment
      const { data: farm } = await supabase
        .from("farms")
        .select("created_at")
        .eq("id", farmId)
        .single();

      if (farm?.created_at && farm.created_at < FEATURE_DEPLOY_DATE) {
        // Pre-existing farm — auto-dismiss permanently
        localStorage.setItem(dismissedKey(farmId), "true");
        setDismissed(true);
        return;
      }

      // Fetch animal count only if not passed from parent
      if (totalAnimals === undefined) {
        const { count } = await supabase
          .from("animals")
          .select("id", { count: "exact", head: true })
          .eq("farm_id", farmId)
          .eq("is_deleted", false);
        setAnimalCount(count ?? 0);
      }

      // Check if any milking records exist
      const { count: milkCount } = await (supabase
        .from("milking_records") as any)
        .select("id", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .limit(1);
      setHasMilkingRecords((milkCount ?? 0) > 0);

      // Check if any milk sale revenue exists
      const { count: saleCount } = await (supabase
        .from("farm_revenues") as any)
        .select("id", { count: "exact", head: true })
        .eq("farm_id", farmId)
        .eq("source", REVENUE_SOURCE_KEYS.MILK_SALE)
        .eq("is_deleted", false)
        .limit(1);
      setHasMilkSale((saleCount ?? 0) > 0);
    };

    fetchProgress();
  }, [farmId, dismissed, totalAnimals]);

  // Update animal count when passed from parent
  useEffect(() => {
    if (totalAnimals !== undefined) {
      setAnimalCount(totalAnimals);
    }
  }, [totalAnimals]);

  const steps: ChecklistStep[] = useMemo(() => [
    {
      id: "add_animal",
      label: "Add your first animal",
      sublabel: "Mag-dagdag ng hayop",
      done: animalCount > 0,
      action: () => {
        navigate("/animals/new");
      },
    },
    {
      id: "record_milk",
      label: "Record first milking",
      sublabel: "I-record ang gatas",
      done: hasMilkingRecords === true,
      action: () => {
        openBulkRecording("milk");
      },
    },
    {
      id: "check_inventory",
      label: "Check milk inventory",
      sublabel: "Tingnan ang milk stock",
      done: visitedMilkTab,
      action: () => {
        localStorage.setItem(visitedMilkKey(farmId), "true");
        navigate("/operations/milk");
      },
    },
    {
      id: "record_sale",
      label: "Record first sale",
      sublabel: "I-record ang benta",
      done: hasMilkSale === true,
      action: () => {
        navigate("/operations/milk?highlight=milk-species");
      },
    },
    {
      id: "view_earnings",
      label: "View your earnings",
      sublabel: "Tingnan ang kita",
      done: visitedFinance,
      action: () => {
        localStorage.setItem(visitedFinanceKey(farmId), "true");
        navigate("/money");
      },
    },
  ], [animalCount, hasMilkingRecords, hasMilkSale, visitedMilkTab, visitedFinance, navigate, farmId, openBulkRecording]);

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Auto-dismiss permanently once all steps are completed
  useEffect(() => {
    if (allDone && !dismissed) {
      localStorage.setItem(dismissedKey(farmId), "true");
      setDismissed(true);
    }
  }, [allDone, dismissed, farmId]);

  // Don't show if dismissed, all done, or still loading
  if (dismissed || allDone) return null;
  if (hasMilkingRecords === null || hasMilkSale === null) return null;

  const handleDismiss = () => {
    localStorage.setItem(dismissedKey(farmId), "true");
    setDismissed(true);
  };

  // Find next incomplete step
  const nextStep = steps.find(s => !s.done);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Simulan ang iyong farm</p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{steps.length} steps — {progressPercent}% done
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-1 -mt-1"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Progress value={progressPercent} className="h-1.5" />

        <div className="space-y-1">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={step.action}
              className="flex items-center gap-2 w-full text-left py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors"
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-tight ${step.done ? "text-muted-foreground line-through" : "font-medium"}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight">{step.sublabel}</p>
              </div>
              {!step.done && step.id === nextStep?.id && (
                <ChevronRight className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { REVENUE_SOURCE_KEYS } from "@/lib/revenueCategories";

const DISMISSED_KEY = "onboarding_checklist_dismissed";
const VISITED_MILK_TAB_KEY = "onboarding_visited_milk_tab";
const VISITED_FINANCE_KEY = "onboarding_visited_finance";

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
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");
  const [hasMilkingRecords, setHasMilkingRecords] = useState<boolean | null>(null);
  const [hasMilkSale, setHasMilkSale] = useState<boolean | null>(null);
  const [animalCount, setAnimalCount] = useState<number>(totalAnimals ?? 0);

  // Track tab visits
  const visitedMilkTab = localStorage.getItem(VISITED_MILK_TAB_KEY) === "true";
  const visitedFinance = localStorage.getItem(VISITED_FINANCE_KEY) === "true";

  // Fetch data only once on mount
  useEffect(() => {
    if (dismissed) return;

    const fetchProgress = async () => {
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
      label: "Mag-dagdag ng hayop",
      sublabel: "Add your first animal",
      done: animalCount > 0,
      action: () => navigate("/?tab=herd"),
    },
    {
      id: "record_milk",
      label: "I-record ang gatas",
      sublabel: "Record first milking",
      done: hasMilkingRecords === true,
      action: () => navigate("/?tab=operations&subtab=milk"),
    },
    {
      id: "check_inventory",
      label: "Tingnan ang milk stock",
      sublabel: "Check milk inventory",
      done: visitedMilkTab,
      action: () => {
        localStorage.setItem(VISITED_MILK_TAB_KEY, "true");
        navigate("/?tab=operations&subtab=milk");
      },
    },
    {
      id: "record_sale",
      label: "I-record ang benta",
      sublabel: "Record first sale",
      done: hasMilkSale === true,
      action: () => navigate("/?tab=operations&subtab=milk"),
    },
    {
      id: "view_earnings",
      label: "Tingnan ang kita",
      sublabel: "View your earnings",
      done: visitedFinance,
      action: () => {
        localStorage.setItem(VISITED_FINANCE_KEY, "true");
        navigate("/?tab=finance");
      },
    },
  ], [animalCount, hasMilkingRecords, hasMilkSale, visitedMilkTab, visitedFinance, navigate]);

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Don't show if dismissed, all done, or still loading
  if (dismissed || allDone) return null;
  if (hasMilkingRecords === null || hasMilkSale === null) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
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

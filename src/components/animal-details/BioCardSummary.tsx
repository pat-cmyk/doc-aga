import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BioCard, BioCardSkeleton } from "@/components/bio-card";
import { StatusBadge } from "@/components/bio-card/StatusAura";
import { useBioCardData, BioCardAnimalData } from "@/hooks/useBioCardData";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface BioCardSummaryProps {
  animal: BioCardAnimalData;
  farmId: string;
  isOnline: boolean;
  defaultExpanded?: boolean;
  onSparklineClick?: (type: "weight" | "bcs" | "milk") => void;
}

export function BioCardSummary({
  animal,
  farmId,
  isOnline,
  defaultExpanded,
  onSparklineClick,
}: BioCardSummaryProps) {
  const isMobile = useIsMobile();
  const storageKey = `biocard-expanded-${animal.id}`;

  // Determine default based on device if not explicitly provided
  const resolvedDefault = defaultExpanded ?? !isMobile;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return resolvedDefault;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : resolvedDefault;
  });

  // Fetch bio data using existing hook
  const bioData = useBioCardData(animal, farmId);

  // Persist expanded state
  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded));
  }, [isExpanded, storageKey]);

  // Don't render if offline and no data
  if (!isOnline && bioData.isLoading) {
    return null;
  }

  if (bioData.isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-3 flex items-center gap-3">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Loading performance data...
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        {/* Collapsed Header - Always Visible */}
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              "flex items-center justify-between p-3 cursor-pointer",
              "hover:bg-muted/50 transition-colors",
              isExpanded && "border-b"
            )}
          >
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                Performance Summary
                <span className="text-muted-foreground ml-1 text-xs hidden sm:inline">
                  (Buod ng Pagganap)
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isExpanded && (
                <>
                  <StatusBadge status={bioData.statusAura} />
                  <span className="text-sm font-medium">
                    OVR {bioData.ovr.score}
                  </span>
                  {bioData.activeAlerts.length > 0 && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      {bioData.activeAlerts.length} alert
                      {bioData.activeAlerts.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded Content - BioCard */}
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <CardContent className="p-0">
            <BioCard
              animal={animal}
              bioData={bioData}
              onSparklineClick={onSparklineClick}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

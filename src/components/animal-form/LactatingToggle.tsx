import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Droplets, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface LactatingToggleProps {
  isLactating: boolean;
  onLactatingChange: (value: boolean) => void;
  daysInMilk: number;
  onDaysChange: (days: number) => void;
}

// Calculate milking stage from days in milk
export function calculateMilkingStageFromDays(days: number): string {
  if (days <= 100) return "Early Lactation";
  if (days <= 200) return "Mid-Lactation";
  return "Late Lactation";
}

export function LactatingToggle({ 
  isLactating, 
  onLactatingChange, 
  daysInMilk, 
  onDaysChange 
}: LactatingToggleProps) {
  const stage = calculateMilkingStageFromDays(daysInMilk);
  
  const stageColors: Record<string, string> = {
    "Early Lactation": "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    "Mid-Lactation": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    "Late Lactation": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  };

  return (
    <div className={cn(
      "rounded-lg border-2 transition-all duration-200",
      isLactating 
        ? "border-primary bg-primary/5 dark:bg-primary/10" 
        : "border-border bg-muted/30"
    )}>
      {/* Toggle Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
            isLactating 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          )}>
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <label htmlFor="lactating-toggle" className="block text-sm font-medium cursor-pointer">
              Is this animal currently milking?
            </label>
            <span className="text-xs text-muted-foreground">
              Nagpapagatas ba?
            </span>
          </div>
        </div>
        <Switch
          id="lactating-toggle"
          checked={isLactating}
          onCheckedChange={onLactatingChange}
        />
      </div>

      {/* Days Input - Only shown when toggle is ON */}
      {isLactating && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Days since last calving
              </label>
              <span className="text-sm font-semibold text-primary">
                {daysInMilk} days
              </span>
            </div>
            <span className="text-xs text-muted-foreground block -mt-1">
              Ilang araw mula nanganak?
            </span>
            
            <Slider
              value={[daysInMilk]}
              onValueChange={(value) => onDaysChange(value[0])}
              min={0}
              max={305}
              step={5}
              className="py-2"
            />
            
            {/* Stage markers */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0</span>
              <span className="text-green-600 dark:text-green-400">Early (0-100)</span>
              <span className="text-amber-600 dark:text-amber-400">Mid (101-200)</span>
              <span className="text-orange-600 dark:text-orange-400">Late (201-305)</span>
            </div>
          </div>

          {/* Stage Preview */}
          <div className="flex items-center gap-2 p-3 rounded-md bg-background border">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              This will place her in:
            </span>
            <Badge 
              variant="outline" 
              className={cn("font-medium", stageColors[stage])}
            >
              {stage}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span>💡</span>
            <span>She will appear in the milk recording dialog immediately</span>
          </p>
        </div>
      )}
    </div>
  );
}
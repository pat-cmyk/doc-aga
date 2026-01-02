import { Switch } from "@/components/ui/switch";
import { Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAddToggleProps {
  isQuickMode: boolean;
  onToggle: (value: boolean) => void;
}

export const QuickAddToggle = ({ isQuickMode, onToggle }: QuickAddToggleProps) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border min-h-14">
      <div className="flex items-center gap-2">
        {isQuickMode ? (
          <Zap className="h-4 w-4 text-primary flex-shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-none">
            {isQuickMode ? "Quick Add" : "Full Details"}
          </span>
          <span className="text-xs text-muted-foreground leading-none">
            {isQuickMode ? "Mabilisang Pagdagdag (5 fields)" : "Buong Detalye"}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-xs transition-colors",
          !isQuickMode ? "text-primary font-medium" : "text-muted-foreground"
        )}>
          Full
        </span>
        <Switch
          checked={isQuickMode}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
        <span className={cn(
          "text-xs transition-colors",
          isQuickMode ? "text-primary font-medium" : "text-muted-foreground"
        )}>
          Quick
        </span>
      </div>
    </div>
  );
};

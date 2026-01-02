import { Switch } from "@/components/ui/switch";
import { Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAddToggleProps {
  isQuickMode: boolean;
  onToggle: (value: boolean) => void;
}

export const QuickAddToggle = ({ isQuickMode, onToggle }: QuickAddToggleProps) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2">
        {isQuickMode ? (
          <Zap className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {isQuickMode ? "Mabilisang Pagdagdag" : "Buong Detalye"}
          </span>
          <span className="text-xs text-muted-foreground">
            {isQuickMode ? "Quick Add (5 fields)" : "Full Details"}
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

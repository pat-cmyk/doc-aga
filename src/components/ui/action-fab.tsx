import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description?: string;
  isPrimary?: boolean;
}

interface ActionFabProps {
  actions: QuickAction[];
  onAction: (actionId: string) => void;
  mainIcon: LucideIcon;
  mainLabel?: string;
}

export function ActionFab({ actions, onAction, mainIcon: MainIcon, mainLabel = "Actions" }: ActionFabProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = (actionId: string) => {
    setIsExpanded(false);
    onAction(actionId);
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* FAB Container */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3">
        {/* Action Buttons */}
        {isExpanded && (
          <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className={cn(
                    "h-12 px-4 rounded-full shadow-lg flex items-center gap-3",
                    action.isPrimary 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "bg-card text-card-foreground hover:bg-accent"
                  )}
                >
                  <Icon className={cn("h-5 w-5", !action.isPrimary && action.color)} />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.description && (
                      <span className="text-xs opacity-70">{action.description}</span>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <Button
          size="lg"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
            isExpanded 
              ? "bg-muted text-muted-foreground hover:bg-muted/80" 
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label={isExpanded ? "Close menu" : mainLabel}
        >
          {isExpanded ? (
            <X className="h-6 w-6" />
          ) : (
            <MainIcon className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  );
}

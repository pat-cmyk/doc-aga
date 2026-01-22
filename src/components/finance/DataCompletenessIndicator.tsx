import { useState } from "react";
import { useDataCompleteness, DataCompletenessItem } from "@/hooks/useDataCompleteness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { AddRevenueDialog } from "./AddRevenueDialog";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  MapPin,
  Users,
  Scale,
  Milk,
  Receipt,
  DollarSign,
  ArrowRight,
  FileText,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface DataCompletenessIndicatorProps {
  farmId: string;
  onNavigateToTab?: (tab: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gps: MapPin,
  address: Building2,
  animals: Users,
  weights: Scale,
  production: Milk,
  expenses: Receipt,
  revenues: DollarSign,
};

export function DataCompletenessIndicator({
  farmId,
  onNavigateToTab,
}: DataCompletenessIndicatorProps) {
  const { data, isLoading } = useDataCompleteness(farmId);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { score, status, items, completedItems, totalItems } = data;
  const incompleteItems = items.filter((item) => !item.isComplete);

  const handleAction = (item: DataCompletenessItem) => {
    if (item.action === "navigate") {
      if (item.actionTarget === "profile") {
        navigate("/profile");
      } else if (item.actionTarget === "animals-weight") {
        // Navigate to animals tab with weight filter
        if (onNavigateToTab) {
          onNavigateToTab("animals");
        }
        // Update URL to trigger weight filter
        navigate("/?tab=animals&filter=missing-weight");
      } else if (onNavigateToTab && item.actionTarget) {
        onNavigateToTab(item.actionTarget);
      }
    }
    // Dialog actions are handled by the inline dialogs
  };

  const getStatusConfig = () => {
    switch (status) {
      case "complete":
        return {
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/20",
          progressColor: "bg-green-500",
          icon: CheckCircle2,
          label: "Bank-Ready",
          description: "Your farm data is complete for financial reporting",
        };
      case "almost":
        return {
          color: "text-amber-600 dark:text-amber-400",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/20",
          progressColor: "bg-amber-500",
          icon: AlertCircle,
          label: "Almost There",
          description: `${totalItems - completedItems} items remaining for a complete report`,
        };
      default:
        return {
          color: "text-orange-600 dark:text-orange-400",
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-500/20",
          progressColor: "bg-orange-500",
          icon: AlertCircle,
          label: "Needs Data",
          description: "Add more data to strengthen your financial report",
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <Card className={cn("border", config.borderColor, config.bgColor)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              {/* Circular Progress Indicator */}
              <div className="relative h-14 w-14 flex-shrink-0">
                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-muted/30"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${(score / 100) * 150.8} 150.8`}
                    strokeLinecap="round"
                    className={config.color}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn("text-sm font-bold", config.color)}>
                    {score}%
                  </span>
                </div>
              </div>

              {/* Status Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("font-semibold text-sm", config.color)}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {config.description}
                </p>
              </div>

              {/* Expand Button */}
              <div className="flex items-center gap-2">
                {status === "complete" && (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-3">
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Data completeness</span>
                <span>
                  {completedItems}/{totalItems} items
                </span>
              </div>
              <Progress value={score} className="h-2" />
            </div>

            {/* Incomplete Items */}
            {incompleteItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Missing data:
                </p>
                {incompleteItems.map((item) => {
                  const Icon = iconMap[item.key] || AlertCircle;

                  if (item.action === "dialog" && item.actionTarget === "expense") {
                    return (
                      <AddExpenseDialog
                        key={item.key}
                        farmId={farmId}
                        trigger={
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              Add <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        }
                      />
                    );
                  }

                  if (item.action === "dialog" && item.actionTarget === "revenue") {
                    return (
                      <AddRevenueDialog
                        key={item.key}
                        farmId={farmId}
                        trigger={
                          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2">
                              Add <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        }
                      />
                    );
                  }

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleAction(item)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        Fix <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Complete Items (collapsed) */}
            {completedItems > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Completed ({completedItems}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items
                    .filter((item) => item.isComplete)
                    .map((item) => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {item.label}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

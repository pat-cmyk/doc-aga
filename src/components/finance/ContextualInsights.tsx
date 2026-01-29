import { useState } from "react";
import { 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  AlertCircle,
  ChevronDown 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContextualInsights, Insight } from "@/hooks/useContextualInsights";
import { cn } from "@/lib/utils";

interface DateRange {
  start: Date;
  end: Date;
}

interface ContextualInsightsProps {
  farmId: string;
  dateRange?: DateRange;
}

const insightConfig: Record<Insight['type'], {
  icon: typeof AlertTriangle;
  borderClass: string;
  iconClass: string;
  bgClass: string;
}> = {
  critical: {
    icon: AlertCircle,
    borderClass: 'border-l-destructive',
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/5',
  },
  warning: {
    icon: AlertTriangle,
    borderClass: 'border-l-yellow-500',
    iconClass: 'text-yellow-600',
    bgClass: 'bg-yellow-500/5',
  },
  success: {
    icon: CheckCircle2,
    borderClass: 'border-l-emerald-500',
    iconClass: 'text-emerald-600',
    bgClass: 'bg-emerald-500/5',
  },
  info: {
    icon: Info,
    borderClass: 'border-l-blue-500',
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-500/5',
  },
};

function InsightItem({ insight }: { insight: Insight }) {
  const config = insightConfig[insight.type];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex gap-3 p-3 rounded-lg border-l-4",
        config.borderClass,
        config.bgClass
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconClass)} />
      <div className="min-w-0">
        <p className="font-medium text-sm leading-tight">{insight.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
      </div>
    </div>
  );
}

export function ContextualInsights({ farmId, dateRange }: ContextualInsightsProps) {
  const { insights, isLoading } = useContextualInsights(farmId, dateRange);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Don't render if no insights
  if (insights.length === 0) {
    return null;
  }

  // Mobile: Show only first insight unless expanded
  // Desktop: Show all insights
  const visibleInsights = expanded ? insights : insights.slice(0, 1);
  const hiddenCount = insights.length - 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Smart Tips for Your Farm
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Mobile: Show limited insights */}
        <div className="md:hidden space-y-2">
          {visibleInsights.map((insight) => (
            <InsightItem key={insight.id} insight={insight} />
          ))}
          
          {!expanded && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setExpanded(true)}
            >
              Show {hiddenCount} more tip{hiddenCount > 1 ? 's' : ''}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          )}
          
          {expanded && hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setExpanded(false)}
            >
              Show less
            </Button>
          )}
        </div>

        {/* Desktop: Show all insights */}
        <div className="hidden md:block space-y-2">
          {insights.map((insight) => (
            <InsightItem key={insight.id} insight={insight} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

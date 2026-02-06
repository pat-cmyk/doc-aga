import { DefinitionBadge } from "@/components/ui/definition-badge";
import {
  FEEDBACK_PRIORITY_URGENCY,
  HEALTH_STATUS_SEVERITY,
  FEED_SECURITY_URGENCY,
  VETERINARY_COST_SEVERITY,
} from "@/lib/urgencyGlossary";
import { cn } from "@/lib/utils";

export type LegendType = "feedback" | "health" | "feed" | "veterinary_cost";

interface PriorityLegendProps {
  type: LegendType;
  showLabel?: boolean;
  className?: string;
}

/**
 * Context-aware legend component that renders priority/severity badges with tooltip definitions.
 * Pulls definitions from the centralized urgencyGlossary.ts (SSOT).
 */
export const PriorityLegend = ({
  type,
  showLabel = true,
  className,
}: PriorityLegendProps) => {
  const getLegendConfig = () => {
    switch (type) {
      case "feedback":
        return {
          label: "Priority Legend:",
          items: [
            { key: "critical", ...FEEDBACK_PRIORITY_URGENCY.critical, variant: "destructive" as const },
            { key: "high", ...FEEDBACK_PRIORITY_URGENCY.high, variant: "default" as const, badgeClass: "bg-orange-500 hover:bg-orange-500/80" },
            { key: "medium", ...FEEDBACK_PRIORITY_URGENCY.medium, variant: "default" as const, badgeClass: "bg-yellow-500 hover:bg-yellow-500/80 text-primary-foreground" },
            { key: "low", ...FEEDBACK_PRIORITY_URGENCY.low, variant: "secondary" as const },
          ],
        };
      case "health":
        return {
          label: "Severity Legend:",
          items: [
            { key: "critical", ...HEALTH_STATUS_SEVERITY.critical, variant: "destructive" as const },
            { key: "high", ...HEALTH_STATUS_SEVERITY.high, variant: "default" as const, badgeClass: "bg-orange-500 hover:bg-orange-500/80" },
            { key: "moderate", ...HEALTH_STATUS_SEVERITY.moderate, variant: "default" as const, badgeClass: "bg-yellow-500 hover:bg-yellow-500/80 text-primary-foreground" },
            { key: "low", ...HEALTH_STATUS_SEVERITY.low, variant: "secondary" as const, badgeClass: "bg-green-500 hover:bg-green-500/80 text-white" },
          ],
        };
      case "feed":
        return {
          label: "Stock Level:",
          items: [
            { key: "critical", ...FEED_SECURITY_URGENCY.critical, variant: "destructive" as const },
            { key: "warning", ...FEED_SECURITY_URGENCY.warning, variant: "default" as const, badgeClass: "bg-orange-500 hover:bg-orange-500/80" },
            { key: "adequate", ...FEED_SECURITY_URGENCY.adequate, variant: "default" as const, badgeClass: "bg-green-500 hover:bg-green-500/80 text-white" },
          ],
        };
      case "veterinary_cost":
        return {
          label: "Cost Level:",
          items: [
            { key: "critical", ...VETERINARY_COST_SEVERITY.critical, variant: "destructive" as const },
            { key: "high", ...VETERINARY_COST_SEVERITY.high, variant: "default" as const, badgeClass: "bg-orange-500 hover:bg-orange-500/80" },
            { key: "moderate", ...VETERINARY_COST_SEVERITY.moderate, variant: "default" as const, badgeClass: "bg-yellow-500 hover:bg-yellow-500/80 text-primary-foreground" },
            { key: "low", ...VETERINARY_COST_SEVERITY.low, variant: "secondary" as const, badgeClass: "bg-green-500 hover:bg-green-500/80 text-white" },
          ],
        };
      default:
        return { label: "Legend:", items: [] };
    }
  };

  const config = getLegendConfig();

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
      {config.items.map((item) => (
        <DefinitionBadge
          key={item.key}
          label={item.label}
          description={item.description}
          variant={item.variant}
          className={cn("text-xs", item.badgeClass)}
        />
      ))}
    </div>
  );
};

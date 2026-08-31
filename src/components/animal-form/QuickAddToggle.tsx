import { Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAddToggleProps {
  isQuickMode: boolean;
  onToggle: (value: boolean) => void;
}

/**
 * Quick/Full mode picker (UX redesign Phase 3).
 *
 * A segmented control instead of the old Switch: a switch reads as on/off,
 * not as a choice between two named modes — farmers had to guess which side
 * was active. Two labeled buttons make the current mode unmissable.
 */
export const QuickAddToggle = ({ isQuickMode, onToggle }: QuickAddToggleProps) => {
  const options = [
    {
      quick: true,
      icon: Zap,
      label: "Quick Add",
      sublabel: "Mabilis — 5 fields",
    },
    {
      quick: false,
      icon: FileText,
      label: "Full Details",
      sublabel: "Kumpleto — lahat ng field",
    },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Form mode"
      className="grid grid-cols-2 rounded-lg border overflow-hidden"
    >
      {options.map(({ quick, icon: Icon, label, sublabel }) => {
        const selected = isQuickMode === quick;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(quick)}
            className={cn(
              "min-h-[52px] px-3 py-2 flex flex-col items-center justify-center gap-0.5 transition-colors touch-manipulation",
              quick ? "" : "border-l",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            <span className={cn("text-[11px] leading-tight", selected ? "opacity-85" : "")}>
              {sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};

import { Lightbulb } from "lucide-react";
import {
  getBirthWeightHint,
  getEntryWeightHint,
  getCurrentWeightHint,
  formatWeightHint,
  type WeightHint,
} from "@/lib/weightHints";

interface WeightHintBadgeProps {
  livestockType: string;
  gender?: string | null;
  lifeStage?: string | null;
  weightType: "birth" | "entry" | "current";
  className?: string;
}

export function WeightHintBadge({
  livestockType,
  gender,
  lifeStage,
  weightType,
  className = "",
}: WeightHintBadgeProps) {
  let hint: WeightHint;

  switch (weightType) {
    case "birth":
      hint = getBirthWeightHint(livestockType);
      break;
    case "entry":
      hint = getEntryWeightHint(livestockType, gender);
      break;
    case "current":
      hint = getCurrentWeightHint(livestockType, gender, lifeStage);
      break;
  }

  const displayText = formatWeightHint(hint);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <Lightbulb className="h-3 w-3 flex-shrink-0" />
      <span>{displayText}</span>
    </div>
  );
}

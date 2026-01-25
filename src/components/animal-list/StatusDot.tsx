import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatusDotType = 'green' | 'yellow' | 'red';

/** Triage reason codes for veterinary-priority status display */
export type StatusReason = 
  // Red reasons (critical)
  | 'withdrawal_milk_sold'     // Food safety critical
  | 'overdue_delivery'         // Past expected calving
  | 'multiple_overdue_vaccines'// 2+ overdue vaccinations
  | 'active_health_issue'      // Current health problem
  | 'quarantined'              // Isolated for disease
  // Yellow reasons (attention needed)
  | 'single_overdue_vaccine'   // 1 overdue vaccination
  | 'near_delivery'            // Within 7 days of calving
  | 'in_heat_window'           // Optimal breeding window
  | 'critical_bcs'             // BCS ≤2.0 or ≥4.5
  | 'active_withdrawal'        // Under withdrawal, milk not sold
  // Green
  | 'healthy'                  // All clear
  | undefined;

interface StatusDotProps {
  status: StatusDotType;
  reason?: StatusReason;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const statusStyles: Record<StatusDotType, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const statusLabels: Record<StatusDotType, { en: string; tl: string }> = {
  green: { en: 'Healthy', tl: 'Malusog' },
  yellow: { en: 'Needs Attention', tl: 'Kailangang Pansin' },
  red: { en: 'Critical', tl: 'Kritikal' },
};

/** Specific reason labels for triage tooltips */
const reasonLabels: Record<NonNullable<StatusReason>, { en: string; tl: string }> = {
  // Red
  withdrawal_milk_sold: { en: 'Withdrawal Period - Do Not Sell Milk!', tl: 'Panahon ng Withdrawal - Huwag Ibenta ang Gatas!' },
  overdue_delivery: { en: 'Overdue Delivery', tl: 'Lampas na ang Panganganak' },
  multiple_overdue_vaccines: { en: 'Multiple Overdue Vaccines', tl: 'Maraming Lampas na Bakuna' },
  active_health_issue: { en: 'Active Health Issue', tl: 'May Sakit' },
  quarantined: { en: 'Quarantined', tl: 'Nakabukod' },
  // Yellow
  single_overdue_vaccine: { en: 'Overdue Vaccine', tl: 'Lampas na Bakuna' },
  near_delivery: { en: 'Calving Soon', tl: 'Malapit na Manganak' },
  in_heat_window: { en: 'In Heat - Breed Now', tl: 'May Init - Pakawin Ngayon' },
  critical_bcs: { en: 'Critical Body Condition', tl: 'Kritikal na Kondisyon ng Katawan' },
  active_withdrawal: { en: 'Under Withdrawal Period', tl: 'Nasa Panahon ng Withdrawal' },
  // Green
  healthy: { en: 'Healthy', tl: 'Malusog' },
};

const sizeStyles = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

export function StatusDot({
  status,
  reason,
  size = 'sm',
  pulse = true,
  className,
}: StatusDotProps) {
  const shouldPulse = pulse && (status === 'yellow' || status === 'red');
  
  // Use specific reason label if provided, otherwise fall back to generic status
  const displayLabel = reason && reasonLabels[reason] 
    ? reasonLabels[reason] 
    : statusLabels[status];
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-block rounded-full shrink-0',
              statusStyles[status],
              sizeStyles[size],
              shouldPulse && 'animate-pulse',
              className
            )}
            aria-label={displayLabel.en}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{displayLabel.en}</p>
          <p className="text-muted-foreground">{displayLabel.tl}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";

interface ExpiryBadgeProps {
  expiryDate: string | null;
  className?: string;
}

export function ExpiryBadge({ expiryDate, className }: ExpiryBadgeProps) {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const daysUntil = differenceInDays(expiry, today);

  if (daysUntil < 0) {
    return (
      <Badge variant="destructive" className={className}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Expired
      </Badge>
    );
  }

  if (daysUntil === 0) {
    return (
      <Badge variant="destructive" className={className}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Expires Today
      </Badge>
    );
  }

  if (daysUntil <= 7) {
    return (
      <Badge variant="destructive" className={className}>
        <Clock className="h-3 w-3 mr-1" />
        {daysUntil}d left
      </Badge>
    );
  }

  if (daysUntil <= 30) {
    return (
      <Badge 
        variant="outline" 
        className={`border-amber-500 text-amber-600 dark:text-amber-400 ${className}`}
      >
        <Clock className="h-3 w-3 mr-1" />
        {daysUntil}d left
      </Badge>
    );
  }

  // Don't show badge for items expiring in more than 30 days
  return null;
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GenderIndicatorProps {
  gender: string | null | undefined;
  className?: string;
}

/**
 * Compact gender symbol for use in cards and lists
 */
export function GenderSymbol({ gender, className }: GenderIndicatorProps) {
  if (!gender) return null;
  
  const isFemale = gender === "Female";
  
  return (
    <span 
      className={cn(
        "font-medium text-sm",
        isFemale ? "text-pink-500" : "text-blue-500",
        className
      )}
      title={isFemale ? "Female / Babae" : "Male / Lalaki"}
      aria-label={isFemale ? "Female" : "Male"}
    >
      {isFemale ? "♀" : "♂"}
    </span>
  );
}

/**
 * Badge-style gender indicator for use in profiles
 */
export function GenderBadge({ gender, className }: GenderIndicatorProps) {
  if (!gender) return null;
  
  const isFemale = gender === "Female";
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs border",
        isFemale 
          ? "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30" 
          : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
        className
      )}
    >
      <span className="mr-1">{isFemale ? "♀" : "♂"}</span>
      <span className="hidden sm:inline">{gender}</span>
    </Badge>
  );
}

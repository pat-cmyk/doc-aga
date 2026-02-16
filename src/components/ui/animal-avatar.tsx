import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getLivestockEmoji } from "@/lib/filipinoLabels";

/**
 * SSOT component for rendering animal avatars across the entire app.
 * 
 * Ensures consistent:
 * - Cache-busting on avatar URLs
 * - Fallback hierarchy: photo → first letter → livestock emoji
 * - Size variants
 * 
 * Used by: AnimalDetails, AnimalList, AnimalCard, BioCard, AnimalProfile, ActivityDetailsDialog
 */

const sizeClasses = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
} as const;

const fallbackTextSize = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
} as const;

export interface AnimalAvatarProps {
  avatarUrl?: string | null;
  animalName?: string | null;
  earTag?: string | null;
  livestockType?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
}

/**
 * Generates a stable cache-busting suffix from the URL itself.
 * Uses a simple hash so the same URL always produces the same suffix,
 * avoiding unnecessary re-renders (unlike Date.now()).
 */
function stableHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getCacheBustedUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${stableHash(url)}`;
}

export function AnimalAvatar({
  avatarUrl,
  animalName,
  earTag,
  livestockType,
  size = "md",
  className,
}: AnimalAvatarProps) {
  const imgSrc = avatarUrl ? getCacheBustedUrl(avatarUrl) : undefined;

  // Fallback: first letter of name or tag, else livestock emoji
  const letterFallback = (animalName?.[0] || earTag?.[0] || "").toUpperCase();
  const emojiFallback = getLivestockEmoji(livestockType || "cattle");
  const fallbackContent = letterFallback || emojiFallback;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage
        src={imgSrc}
        alt={animalName || earTag || "Animal"}
        key={avatarUrl || undefined}
      />
      <AvatarFallback className={cn(fallbackTextSize[size], "bg-muted")}>
        {fallbackContent}
      </AvatarFallback>
    </Avatar>
  );
}

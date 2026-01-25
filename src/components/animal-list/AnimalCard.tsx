import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { GenderSymbol } from "@/components/ui/gender-indicator";
import { Scale, Database, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SwipeableAnimalCard } from "./SwipeableAnimalCard";
import { OVRIndicator, type OVRTier, type OVRTrend } from "./OVRIndicator";
import { StatusDot, type StatusDotType, type StatusReason } from "./StatusDot";
import type { Animal } from "./hooks/useAnimalList";
import { getEffectiveWeight } from "@/lib/animalWeightUtils";

interface AnimalCardProps {
  animal: Animal;
  isCached: boolean;
  isDownloading: boolean;
  lifeStageDefinition: string;
  milkingStageDefinition: string;
  lifeStageBadgeColor: string;
  milkingStageBadgeColor: string;
  livestockIcon: string;
  onClick: () => void;
  onCacheOffline?: () => void;
  onViewDetails?: () => void;
  // OVR quick stats (optional - graceful degradation)
  ovrScore?: number;
  ovrTier?: OVRTier;
  ovrTrend?: OVRTrend;
  statusDot?: StatusDotType;
  statusReason?: StatusReason;
  alertCount?: number;
}

export const AnimalCard = ({
  animal,
  isCached,
  isDownloading,
  lifeStageDefinition,
  milkingStageDefinition,
  lifeStageBadgeColor,
  milkingStageBadgeColor,
  livestockIcon,
  onClick,
  onCacheOffline,
  onViewDetails,
  ovrScore,
  ovrTier,
  ovrTrend,
  statusDot,
  statusReason,
  alertCount,
}: AnimalCardProps) => {
  const isMobile = useIsMobile();
  const effectiveWeight = getEffectiveWeight(animal);
  
  const getCacheIcon = () => {
    if (isDownloading) {
      return (
        <span title="Downloading for offline use...">
          <Database className="h-3 w-3 text-yellow-500 animate-pulse" />
        </span>
      );
    }
    
    if (isCached) {
      return (
        <span title="Available offline">
          <Database className="h-3 w-3 text-green-500" />
        </span>
      );
    }
    
    return (
      <span title="Not cached offline">
        <Database className="h-3 w-3 text-muted-foreground/50" />
      </span>
    );
  };

  // Get triage border color based on status
  const getTriageBorderClass = () => {
    if (!statusDot) return "";
    switch (statusDot) {
      case 'red':
        return "border-l-4 border-l-red-500 dark:border-l-red-400";
      case 'yellow':
        return "border-l-4 border-l-yellow-500 dark:border-l-yellow-400";
      default:
        return "";
    }
  };

  const triageBorderClass = getTriageBorderClass();

  // Mobile card content (extracted for reuse)
  const mobileCardContent = (
    <Card
      className={cn(
        "cursor-pointer active:scale-[0.98] transition-transform",
        triageBorderClass
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar with status dot overlay */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
              <AvatarFallback className="text-sm">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
            </Avatar>
            {statusDot && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={statusDot} reason={statusReason} size="sm" />
              </div>
            )}
          </div>
          
          {/* Info section - compact layout */}
          <div className="flex-1 min-w-0">
            {/* Name row with gender, livestock icon and cache status */}
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm truncate max-w-[120px]">
                {animal.name || "Unnamed"}
              </h3>
              <GenderSymbol gender={animal.gender} />
              <span className="text-sm shrink-0">{livestockIcon}</span>
              {getCacheIcon()}
            </div>
            
            {/* Breed and ear tag - single line truncated */}
            <p className="text-xs text-muted-foreground truncate">
              {animal.breed} • {animal.ear_tag}
            </p>
          </div>
          
          {/* Right side: OVR + Stage badges stacked + weight chip */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col gap-1 items-end">
              {/* OVR Indicator - only show if cached (score > 0) */}
              {ovrScore !== undefined && ovrScore > 0 && ovrTier && (
                <OVRIndicator
                  score={ovrScore}
                  tier={ovrTier}
                  trend={ovrTrend}
                  size="xs"
                />
              )}
              {animal.lifeStage && (
                <Badge 
                  variant="secondary" 
                  className={`text-[10px] px-1.5 py-0 h-5 ${lifeStageBadgeColor}`}
                >
                  {animal.lifeStage.split(' ').slice(0, 2).join(' ')}
                </Badge>
              )}
              {effectiveWeight && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  <Scale className="h-2.5 w-2.5 mr-0.5" />
                  {effectiveWeight}kg
                </Badge>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Compact mobile variant with swipe gestures
  if (isMobile) {
    return (
      <SwipeableAnimalCard
        onSwipeLeftAction={onCacheOffline || (() => {})}
        onSwipeRightAction={onViewDetails || onClick}
        isCached={isCached}
        isDownloading={isDownloading}
      >
        {mobileCardContent}
      </SwipeableAnimalCard>
    );
  }

  // Desktop variant (original)
  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        triageBorderClass
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar with status dot overlay */}
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14">
              <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
              <AvatarFallback className="text-lg">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
            </Avatar>
            {statusDot && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <StatusDot status={statusDot} reason={statusReason} size="md" />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-base truncate">{animal.name || "Unnamed"}</h3>
              <GenderSymbol gender={animal.gender} />
              <span className="text-lg">{livestockIcon}</span>
              {getCacheIcon()}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {animal.breed} • {animal.ear_tag}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {/* OVR Indicator for desktop - only show if cached (score > 0) */}
              {ovrScore !== undefined && ovrScore > 0 && ovrTier && (
                <OVRIndicator
                  score={ovrScore}
                  tier={ovrTier}
                  trend={ovrTrend}
                  size="sm"
                />
              )}
              {animal.lifeStage && (
                <StageBadge 
                  stage={animal.lifeStage}
                  definition={lifeStageDefinition}
                  colorClass={lifeStageBadgeColor}
                />
              )}
              {animal.milkingStage && (
                <StageBadge 
                  stage={animal.milkingStage}
                  definition={milkingStageDefinition}
                  colorClass={milkingStageBadgeColor}
                />
              )}
              {effectiveWeight && (
                <Badge variant="outline" className="text-xs">
                  <Scale className="h-3 w-3 mr-1" />
                  {effectiveWeight} kg
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
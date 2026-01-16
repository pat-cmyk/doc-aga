import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { GenderSymbol } from "@/components/ui/gender-indicator";
import { Scale, Database, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SwipeableAnimalCard } from "./SwipeableAnimalCard";
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

  // Mobile card content (extracted for reuse)
  const mobileCardContent = (
    <Card
      className="cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          {/* Smaller avatar on mobile */}
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
            <AvatarFallback className="text-sm">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
          </Avatar>
          
          {/* Info section - compact layout */}
          <div className="flex-1 min-w-0">
            {/* Name row with gender, livestock icon and cache status */}
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm truncate max-w-[140px]">
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
          
          {/* Right side: Stage badges stacked + weight chip */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col gap-1 items-end">
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
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
            <AvatarFallback className="text-lg">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
          </Avatar>
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
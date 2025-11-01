import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { Scale, Database } from "lucide-react";
import type { Animal } from "./hooks/useAnimalList";

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
  onClick
}: AnimalCardProps) => {
  const getCacheIcon = () => {
    if (isDownloading) {
      return (
        <span title="Downloading for offline use...">
          <Database className="h-3.5 w-3.5 text-yellow-500 animate-pulse inline-block ml-1" />
        </span>
      );
    }
    
    if (isCached) {
      return (
        <span title="Available offline">
          <Database className="h-3.5 w-3.5 text-green-500 inline-block ml-1" />
        </span>
      );
    }
    
    return (
      <span title="Not cached offline">
        <Database className="h-3.5 w-3.5 text-gray-400 inline-block ml-1" />
      </span>
    );
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
            <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
            <AvatarFallback className="text-base sm:text-lg">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-sm sm:text-base truncate">{animal.name || "Unnamed"}</h3>
              <span className="text-lg">{livestockIcon}</span>
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <p className="truncate">{animal.breed} • {animal.ear_tag}</p>
              {getCacheIcon()}
            </div>
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
              {animal.current_weight_kg && (
                <Badge variant="outline" className="text-xs">
                  <Scale className="h-3 w-3 mr-1" />
                  {animal.current_weight_kg} kg
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

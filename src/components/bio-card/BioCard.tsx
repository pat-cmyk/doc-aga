import React, { useState } from "react";
import { RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { OVRBadge } from "./OVRBadge";
import { StatusAura, StatusBadge } from "./StatusAura";
import { PerformanceRadar } from "./PerformanceRadar";
import { TrendSparkline } from "./TrendSparkline";
import { AlertsTicker } from "./AlertsTicker";
import { ReproClock } from "./ReproClock";
import { ImmunityShield } from "./ImmunityShield";
import { MedicalTimeline } from "./MedicalTimeline";
import { LactationTimeline } from "./LactationTimeline";
import type { BioCardData, BioCardAnimalData } from "@/hooks/useBioCardData";
import { getLivestockEmoji } from "@/lib/filipinoLabels";

interface BioCardProps {
  animal: BioCardAnimalData;
  bioData: BioCardData;
  className?: string;
  onFlip?: (isFlipped: boolean) => void;
  onSparklineClick?: (type: 'weight' | 'bcs' | 'milk') => void;
}

export function BioCard({
  animal,
  bioData,
  className,
  onFlip,
  onSparklineClick,
}: BioCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    const newState = !isFlipped;
    setIsFlipped(newState);
    onFlip?.(newState);
  };

  const livestockEmoji = getLivestockEmoji(animal.livestock_type);

  if (bioData.isLoading) {
    return <BioCardSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        "relative w-full perspective-1000",
        className
      )}
      style={{ perspective: "1000px" }}
    >
      <div
        className={cn(
          "relative w-full transition-transform duration-600 transform-style-3d",
          isFlipped && "rotate-y-180"
        )}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.6s ease-in-out",
        }}
      >
        {/* Front Face - Farmer View */}
        <Card
          className={cn(
            "absolute inset-0 w-full backface-hidden",
            "border-2 shadow-lg"
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <CardContent className="p-4 space-y-4">
            {/* Header: Identity */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusAura status={bioData.statusAura} size="md">
                  <Avatar className="w-16 h-16">
                    <AvatarImage 
                      src={animal.avatar_url || undefined} 
                      alt={animal.name || 'Animal'} 
                    />
                    <AvatarFallback className="text-2xl bg-muted">
                      {livestockEmoji}
                    </AvatarFallback>
                  </Avatar>
                </StatusAura>
                
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg leading-tight">
                    {animal.name || animal.ear_tag || 'Unnamed'}
                  </h3>
                  {animal.ear_tag && animal.name && (
                    <p className="text-sm text-muted-foreground">
                      {animal.ear_tag}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {animal.life_stage && (
                      <Badge variant="outline" className="text-xs">
                        {animal.life_stage}
                      </Badge>
                    )}
                    {animal.breed && (
                      <Badge variant="secondary" className="text-xs">
                        {animal.breed}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <OVRBadge
                score={bioData.ovr.score}
                tier={bioData.ovr.tier}
                trend={bioData.ovr.trend}
                breakdown={bioData.ovr.breakdown}
                size="md"
              />
            </div>

            {/* Performance Radar */}
            <div className="relative">
              <PerformanceRadar
                data={bioData.radarData}
                showBenchmark={true}
                size="md"
              />
            </div>

            {/* Trend Sparklines */}
            <div className="grid grid-cols-3 gap-2">
              <TrendSparkline
                data={bioData.weightSparkline}
                label="Weight"
                labelFilipino="Timbang"
                type="weight"
                height={32}
                onClick={() => onSparklineClick?.('weight')}
              />
              <TrendSparkline
                data={bioData.bcsSparkline}
                label="BCS"
                labelFilipino="Kondisyon"
                type="bcs"
                height={32}
                onClick={() => onSparklineClick?.('bcs')}
              />
              <TrendSparkline
                data={bioData.milkSparkline}
                label="Milk"
                labelFilipino="Gatas"
                type="milk"
                height={32}
                onClick={() => onSparklineClick?.('milk')}
              />
            </div>

            {/* Market Value */}
            {bioData.estimatedValue !== null && (
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Estimated Value <span className="hidden sm:inline">(Tinatayang Halaga)</span>
                  </p>
                  <p className="text-lg font-bold text-primary">
                    ₱{bioData.estimatedValue.toLocaleString()}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>₱{bioData.marketPricePerKg}/kg</p>
                  <p className="text-[10px]">{bioData.priceSource}</p>
                </div>
              </div>
            )}

            {/* Alerts */}
            <AlertsTicker alerts={bioData.activeAlerts} maxAlerts={3} />

            {/* Flip Button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={handleFlip}
            >
              <span>Vet View</span>
              <span className="text-muted-foreground ml-1">(Tingin ng Beterinaryo)</span>
              <ChevronRight className="w-4 h-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>

        {/* Back Face - Vet View */}
        <Card
          className={cn(
            "absolute inset-0 w-full backface-hidden rotate-y-180",
            "border-2 shadow-lg"
          )}
          style={{ 
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <CardContent className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{livestockEmoji}</span>
                <div>
                  <h3 className="font-semibold">
                    {animal.name || animal.ear_tag || 'Unnamed'}
                  </h3>
                  <p className="text-xs text-muted-foreground">Vet View</p>
                </div>
              </div>
              <StatusBadge status={bioData.statusAura} />
            </div>

            {/* Phase 3 Components - Vet View */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {/* ReproClock - Female animals only */}
              {animal.gender?.toLowerCase() === 'female' && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    🔄 Reproductive Cycle
                    <span className="text-xs text-muted-foreground">(Siklo)</span>
                  </h4>
                  <div className="flex justify-center">
                    <ReproClock
                      reproStatus={bioData.reproStatus}
                      livestockType={animal.livestock_type}
                      size="md"
                    />
                  </div>
                </div>
              )}

              {/* LactationTimeline - Lactating females only */}
              {bioData.lactationInfo?.stage && animal.gender?.toLowerCase() === 'female' && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <LactationTimeline
                    milkingStage={bioData.lactationInfo.stage}
                    daysInMilk={bioData.lactationInfo.daysInMilk}
                    milkSparkline={bioData.milkSparkline}
                    livestockType={animal.livestock_type}
                    size="full"
                  />
                </div>
              )}

              {/* ImmunityShield */}
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  🛡️ Immunity Shield
                  <span className="text-xs text-muted-foreground">(Kalasag)</span>
                </h4>
                <ImmunityShield
                  immunityStatus={bioData.immunityStatus}
                  size="md"
                  showDetails
                />
              </div>

              {/* MedicalTimeline */}
              <div className="p-3 rounded-lg bg-muted/50">
                <MedicalTimeline
                  animalId={animal.id}
                  farmId={animal.farm_id}
                  maxItems={5}
                />
              </div>

              {/* Growth Benchmark Summary */}
              {bioData.growthBenchmark && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    📈 Growth Status
                    <span className="text-xs text-muted-foreground">(Paglaki)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ADG:</span>
                      <span className="ml-1 font-medium">
                        {bioData.growthBenchmark.adgActual?.toFixed(0) ?? 'N/A'}g
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className={cn(
                        "ml-1 font-medium",
                        bioData.growthBenchmark.status === 'on_track' && "text-green-600 dark:text-green-400",
                        bioData.growthBenchmark.status === 'below' && "text-orange-600 dark:text-orange-400",
                        bioData.growthBenchmark.status === 'above' && "text-blue-600 dark:text-blue-400"
                      )}>
                        {bioData.growthBenchmark.status?.replace('_', ' ') ?? 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Flip Back Button */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={handleFlip}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              <span>Farmer View</span>
              <span className="text-muted-foreground ml-1">(Tingin ng Magsasaka)</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Loading skeleton
function BioCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("border-2", className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="w-20 h-24" />
        </div>
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

export { BioCardSkeleton };

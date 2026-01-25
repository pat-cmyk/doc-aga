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

            {/* Placeholder for Phase 4 components */}
            <div className="space-y-3">
              {/* Repro Status */}
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Reproductive Status</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cycle Day:</span>
                    <span className="ml-1 font-medium">
                      {bioData.reproStatus.cycleDay ?? 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pregnant:</span>
                    <span className="ml-1 font-medium">
                      {bioData.reproStatus.isPregnant ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {bioData.reproStatus.daysToNextHeat !== null && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Next Heat:</span>
                      <span className="ml-1 font-medium">
                        {bioData.reproStatus.daysToNextHeat} days
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Immunity Status */}
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium mb-2">Immunity Shield</h4>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center text-2xl",
                    bioData.immunityStatus.level === 100 && "bg-green-100 dark:bg-green-900/30",
                    bioData.immunityStatus.level === 50 && "bg-yellow-100 dark:bg-yellow-900/30",
                    bioData.immunityStatus.level === 0 && "bg-red-100 dark:bg-red-900/30"
                  )}>
                    {bioData.immunityStatus.level === 100 ? '🛡️' : 
                     bioData.immunityStatus.level === 50 ? '⚠️' : '🔴'}
                  </div>
                  <div>
                    <p className="font-medium">
                      {bioData.immunityStatus.level === 100 ? 'Fully Protected' :
                       bioData.immunityStatus.level === 50 ? 'Booster Due' : 'Overdue'}
                    </p>
                    {bioData.immunityStatus.overdueVaccines.length > 0 && (
                      <p className="text-sm text-destructive">
                        {bioData.immunityStatus.overdueVaccines.length} overdue
                      </p>
                    )}
                    {bioData.immunityStatus.nextDueDate && (
                      <p className="text-xs text-muted-foreground">
                        Next: {bioData.immunityStatus.nextDueDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Growth Benchmark Summary */}
              {bioData.growthBenchmark && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">Growth Status</h4>
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
              className="w-full"
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

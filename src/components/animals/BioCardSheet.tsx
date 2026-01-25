import React, { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { BioCard, BioCardSkeleton } from "@/components/bio-card/BioCard";
import { useBioCardData, type BioCardAnimalData } from "@/hooks/useBioCardData";
import { useIsMobile } from "@/hooks/use-mobile";

interface BioCardSheetProps {
  animal: BioCardAnimalData | null;
  farmId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onViewFullDetails: () => void;
}

export function BioCardSheet({
  animal,
  farmId,
  isOpen,
  onOpenChange,
  onViewFullDetails,
}: BioCardSheetProps) {
  const isMobile = useIsMobile();
  const bioData = useBioCardData(animal, farmId);

  const handleViewDetails = () => {
    onOpenChange(false);
    // Small delay to allow drawer animation to complete
    setTimeout(onViewFullDetails, 150);
  };

  if (!animal) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent 
        className={cn(
          "max-h-[92vh] overflow-hidden",
          isMobile ? "rounded-t-[20px]" : "rounded-t-xl"
        )}
      >
        {/* Custom header with close button */}
        <DrawerHeader className="border-b pb-3 pt-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <span>Quick View</span>
              <span className="text-sm text-muted-foreground font-normal">
                (Mabilis na Tingin)
              </span>
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        {/* Scrollable content area */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ maxHeight: "calc(92vh - 140px)" }}
        >
          {bioData.isLoading ? (
            <BioCardSkeleton />
          ) : (
            <BioCard
              animal={animal}
              bioData={bioData}
              className="mx-auto max-w-lg"
            />
          )}
        </div>

        {/* Fixed footer with action button */}
        <div className="border-t px-4 py-3 bg-background">
          <Button
            onClick={handleViewDetails}
            className="w-full"
            size="lg"
          >
            <span>View Full Records</span>
            <span className="text-muted-foreground/70 ml-1 text-sm">
              (Buong Rekord)
            </span>
            <ChevronRight className="ml-auto h-5 w-5" />
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

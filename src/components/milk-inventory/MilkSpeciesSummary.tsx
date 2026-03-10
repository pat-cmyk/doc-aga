import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpeciesSummary } from "@/hooks/useMilkInventory";
import type { SpeciesPriceMap } from "@/hooks/useRevenues";

interface MilkSpeciesSummaryProps {
  speciesData: SpeciesSummary[];
  pricesBySpecies: SpeciesPriceMap;
  onSellSpecies: (species: string) => void;
  canManage?: boolean;
}

const SPECIES_ICONS: Record<string, string> = {
  cattle: "🐄",
  goat: "🐐",
  carabao: "🐃",
  sheep: "🐑",
};

const SPECIES_LABELS: Record<string, string> = {
  cattle: "Cattle",
  goat: "Goat",
  carabao: "Carabao",
  sheep: "Sheep",
};

export function MilkSpeciesSummary({
  speciesData,
  pricesBySpecies,
  onSellSpecies,
  canManage = true,
}: MilkSpeciesSummaryProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlighted, setHighlighted] = useState(false);

  // Highlight cards when navigated from onboarding checklist
  useEffect(() => {
    if (searchParams.get("highlight") === "milk-species") {
      setHighlighted(true);
      // Clear the URL param without navigation
      const next = new URLSearchParams(searchParams);
      next.delete("highlight");
      setSearchParams(next, { replace: true });
      // Remove highlight after 3 seconds
      const timer = setTimeout(() => setHighlighted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  if (speciesData.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {speciesData.map((species) => {
        const icon = SPECIES_ICONS[species.livestock_type] || "🐄";
        const label = SPECIES_LABELS[species.livestock_type] || species.livestock_type;
        const price = pricesBySpecies[species.livestock_type];

        return (
          <Card
            key={species.livestock_type}
            className={cn(
              "bg-card border-border hover:border-primary/50 transition-colors",
              highlighted && "ring-2 ring-primary animate-pulse"
            )}
          >
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {species.animal_count} animal{species.animal_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-2xl font-bold text-primary">
                  {species.total_liters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L
                </p>
                <p className="text-sm text-muted-foreground">
                  {price ? `~₱${price}/L` : "No price history"}
                </p>
              </div>

              {canManage && (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => onSellSpecies(species.livestock_type)}
                >
                  <DollarSign className="h-4 w-4" />
                  Sell {label}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
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
            className="bg-card border-border hover:border-primary/50 transition-colors"
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

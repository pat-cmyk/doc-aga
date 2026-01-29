import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Milk, AlertTriangle, DollarSign, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { RecordMilkSaleDialog } from "./RecordMilkSaleDialog";
import { EditMilkRecordDialog } from "./EditMilkRecordDialog";
import { DeleteMilkRecordDialog } from "./DeleteMilkRecordDialog";
import { MilkSpeciesSummary } from "./MilkSpeciesSummary";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLastMilkPriceBySpecies } from "@/hooks/useRevenues";
import type { MilkInventoryItem, MilkInventorySummary } from "@/hooks/useMilkInventory";

interface MilkStockListProps {
  farmId: string;
  data?: { items: MilkInventoryItem[]; summary: MilkInventorySummary };
  isLoading: boolean;
  canManage?: boolean;
}

const SPECIES_ICONS: Record<string, string> = {
  cattle: "🐄",
  goat: "🐐",
  carabao: "🐃",
  sheep: "🐑",
};

function getAgeIndicator(date: string): { label: string; variant: "default" | "secondary" | "destructive" } {
  const days = differenceInDays(new Date(), new Date(date));
  if (days <= 2) return { label: "Fresh", variant: "default" };
  if (days <= 5) return { label: "Aging", variant: "secondary" };
  return { label: "Old", variant: "destructive" };
}

export function MilkStockList({ farmId, data, isLoading, canManage = true }: MilkStockListProps) {
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleFilterSpecies, setSaleFilterSpecies] = useState<string | null>(null);
  const [expandedSpecies, setExpandedSpecies] = useState<Set<string>>(new Set());
  const [expandedAnimals, setExpandedAnimals] = useState<Set<string>>(new Set());
  const [editingRecord, setEditingRecord] = useState<MilkInventoryItem | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<MilkInventoryItem | null>(null);

  const { data: pricesBySpecies } = useLastMilkPriceBySpecies(farmId);

  const toggleSpecies = (species: string) => {
    setExpandedSpecies(prev => {
      const next = new Set(prev);
      if (next.has(species)) {
        next.delete(species);
      } else {
        next.add(species);
      }
      return next;
    });
  };

  const toggleAnimal = (animalId: string) => {
    setExpandedAnimals(prev => {
      const next = new Set(prev);
      if (next.has(animalId)) {
        next.delete(animalId);
      } else {
        next.add(animalId);
      }
      return next;
    });
  };

  const handleSellSpecies = (species: string) => {
    setSaleFilterSpecies(species);
    setSaleDialogOpen(true);
  };

  const handleSellAll = () => {
    setSaleFilterSpecies(null);
    setSaleDialogOpen(true);
  };

  // Filter items and compute totals when selling specific species
  const filteredSaleData = useMemo(() => {
    if (!data) return { items: [], total: 0 };
    
    if (!saleFilterSpecies) {
      return { items: data.items, total: data.summary.totalLiters };
    }
    
    const filtered = data.items.filter(item => item.livestock_type === saleFilterSpecies);
    const total = filtered.reduce((sum, item) => sum + item.liters_remaining, 0);
    return { items: filtered, total };
  }, [data, saleFilterSpecies]);

  // Group animals by species
  const animalsBySpecies = useMemo(() => {
    if (!data?.summary?.byAnimal) return new Map<string, typeof data.summary.byAnimal>();
    
    const grouped = new Map<string, typeof data.summary.byAnimal>();
    for (const animal of data.summary.byAnimal) {
      const species = animal.livestock_type || 'cattle';
      if (!grouped.has(species)) {
        grouped.set(species, []);
      }
      grouped.get(species)!.push(animal);
    }
    return grouped;
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!data || data.summary.totalLiters === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Milk className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No unsold milk in inventory</p>
        <p className="text-sm">Milk records marked as "sold" won't appear here</p>
      </div>
    );
  }

  const { summary, items } = data;
  const oldestAge = summary.oldestDate ? differenceInDays(new Date(), new Date(summary.oldestDate)) : 0;

  return (
    <div className="space-y-4">
      {/* Total Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Milk className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Available</p>
                <p className="text-3xl font-bold text-primary">
                  {summary.totalLiters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L
                </p>
              </div>
            </div>
            
            {canManage && (
              <Button onClick={handleSellAll} className="gap-2">
                <DollarSign className="h-4 w-4" />
                Record Sale
              </Button>
            )}
          </div>

          {oldestAge > 3 && (
            <div className="mt-4 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Oldest milk: {oldestAge} days old - Sell older stock first</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Species Summary Cards */}
      {summary.bySpecies && summary.bySpecies.length > 0 && pricesBySpecies && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">By Type</h4>
          <MilkSpeciesSummary
            speciesData={summary.bySpecies}
            pricesBySpecies={pricesBySpecies}
            onSellSpecies={handleSellSpecies}
            canManage={canManage}
          />
        </div>
      )}

      {/* Species > Animal Breakdown */}
      {summary.bySpecies && summary.bySpecies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground px-1">By Species & Animal</h4>
        
          {summary.bySpecies.map((species) => {
          const isSpeciesExpanded = expandedSpecies.has(species.livestock_type);
          const speciesIcon = SPECIES_ICONS[species.livestock_type] || "🐄";
          const animalsInSpecies = animalsBySpecies.get(species.livestock_type) || [];
          
          return (
            <Collapsible 
              key={species.livestock_type} 
              open={isSpeciesExpanded} 
              onOpenChange={() => toggleSpecies(species.livestock_type)}
            >
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isSpeciesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="text-xl">{speciesIcon}</span>
                        <div>
                          <p className="font-medium capitalize">{species.livestock_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {species.animal_count} animal{species.animal_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-lg">
                        {species.total_liters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="ml-4 mt-1 space-y-1">
                  {animalsInSpecies.map((animal) => {
                    const isExpanded = expandedAnimals.has(animal.animal_id);
                    const ageInfo = getAgeIndicator(animal.oldest_date);
                    const animalRecords = items.filter(r => r.animal_id === animal.animal_id);
                    
                    return (
                      <Collapsible key={animal.animal_id} open={isExpanded} onOpenChange={() => toggleAnimal(animal.animal_id)}>
                        <CollapsibleTrigger asChild>
                          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="py-2 px-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  <div>
                                    <p className="font-medium text-sm">
                                      {animal.animal_name || animal.ear_tag || "Unknown"}
                                      {animal.ear_tag && animal.animal_name && (
                                        <span className="text-muted-foreground ml-1">({animal.ear_tag})</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {animal.record_count} record{animal.record_count !== 1 ? "s" : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={ageInfo.variant} className="text-xs">{ageInfo.label}</Badge>
                                  <span className="font-medium">
                                    {animal.total_liters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-1">
                            {animalRecords.map((record) => {
                              const recordAge = getAgeIndicator(record.record_date);
                              return (
                                <div key={record.id} className="flex items-center justify-between py-2 px-3 text-sm bg-muted/50 rounded">
                                  <span className="text-muted-foreground">
                                    {format(new Date(record.record_date), "MMM d, yyyy")}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={recordAge.variant} className="text-xs">
                                      {recordAge.label}
                                    </Badge>
                                    <span className="font-medium">
                                      {record.liters_remaining < 0.05 
                                        ? "< 0.1 L" 
                                        : `${record.liters_remaining.toFixed(1)} L`}
                                    </span>
                                    
                                    {canManage && (
                                      <div className="flex items-center gap-1 ml-1">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setEditingRecord(record); 
                                          }}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setDeletingRecord(record); 
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        </div>
      )}
      {/* Sale Dialog */}
      <RecordMilkSaleDialog
        farmId={farmId}
        open={saleDialogOpen}
        onOpenChange={(open) => {
          setSaleDialogOpen(open);
          if (!open) setSaleFilterSpecies(null);
        }}
        availableItems={filteredSaleData.items}
        totalAvailable={filteredSaleData.total}
        filterSpecies={saleFilterSpecies}
      />
      
      {/* Edit Dialog */}
      {editingRecord && (
        <EditMilkRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          farmId={farmId}
          record={editingRecord}
        />
      )}
      
      {/* Delete Dialog */}
      {deletingRecord && (
        <DeleteMilkRecordDialog
          open={!!deletingRecord}
          onOpenChange={(open) => !open && setDeletingRecord(null)}
          farmId={farmId}
          record={deletingRecord}
        />
      )}
    </div>
  );
}

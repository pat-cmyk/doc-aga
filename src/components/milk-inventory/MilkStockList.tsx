import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Milk, AlertTriangle, DollarSign, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { RecordMilkSaleDialog } from "./RecordMilkSaleDialog";
import { EditMilkRecordDialog } from "./EditMilkRecordDialog";
import { DeleteMilkRecordDialog } from "./DeleteMilkRecordDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MilkInventoryItem, MilkInventorySummary } from "@/hooks/useMilkInventory";

interface MilkStockListProps {
  farmId: string;
  data?: { items: MilkInventoryItem[]; summary: MilkInventorySummary };
  isLoading: boolean;
  canManage?: boolean;
}

function getAgeIndicator(date: string): { label: string; variant: "default" | "secondary" | "destructive" } {
  const days = differenceInDays(new Date(), new Date(date));
  if (days <= 2) return { label: "Fresh", variant: "default" };
  if (days <= 5) return { label: "Aging", variant: "secondary" };
  return { label: "Old", variant: "destructive" };
}

export function MilkStockList({ farmId, data, isLoading, canManage = true }: MilkStockListProps) {
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [expandedAnimals, setExpandedAnimals] = useState<Set<string>>(new Set());
  const [editingRecord, setEditingRecord] = useState<MilkInventoryItem | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<MilkInventoryItem | null>(null);

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
      {/* Summary Card */}
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
              <Button onClick={() => setSaleDialogOpen(true)} className="gap-2">
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

      {/* Animal Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground px-1">By Animal</h4>
        
        {summary.byAnimal.map((animal) => {
          const isExpanded = expandedAnimals.has(animal.animal_id);
          const ageInfo = getAgeIndicator(animal.oldest_date);
          const animalRecords = items.filter(r => r.animal_id === animal.animal_id);
          
          return (
            <Collapsible key={animal.animal_id} open={isExpanded} onOpenChange={() => toggleAnimal(animal.animal_id)}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <div>
                          <p className="font-medium">
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
                      <div className="flex items-center gap-3">
                        <Badge variant={ageInfo.variant}>{ageInfo.label}</Badge>
                        <span className="font-semibold text-lg">
                          {animal.total_liters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="ml-8 mt-1 space-y-1">
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
                          <span className="font-medium">{record.liters.toFixed(1)} L</span>
                          
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

      {/* Sale Dialog */}
      <RecordMilkSaleDialog
        farmId={farmId}
        open={saleDialogOpen}
        onOpenChange={setSaleDialogOpen}
        availableItems={items}
        totalAvailable={summary.totalLiters}
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

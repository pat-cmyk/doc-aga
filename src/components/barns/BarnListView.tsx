import { useState } from "react";
import { useBarns, type Barn } from "@/hooks/useBarns";
import { BarnFormDialog } from "./BarnFormDialog";
import { BarnAnimalManager } from "./BarnAnimalManager";
import { DeleteBarnDialog } from "./DeleteBarnDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Warehouse, Fence, ChevronDown, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BarnListViewProps {
  farmId: string;
  readOnly?: boolean;
}

export function BarnListView({ farmId, readOnly = false }: BarnListViewProps) {
  const { data: barns = [], isLoading } = useBarns(farmId);
  const [formOpen, setFormOpen] = useState(false);
  const [editBarn, setEditBarn] = useState<Barn | null>(null);
  const [deletingBarn, setDeletingBarn] = useState<Barn | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg">Barns & Paddocks</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Kulungan at Pastulan — Group animals by housing location
            </CardDescription>
          </div>
          {!readOnly && (
            <Button size="sm" onClick={() => { setEditBarn(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {barns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No barns or paddocks yet. Create one to group your animals by location.
          </p>
        ) : (
          barns.map(barn => (
            <BarnCard
              key={barn.id}
              barn={barn}
              farmId={farmId}
              allBarns={barns}
              expanded={expandedId === barn.id}
              onToggle={() => setExpandedId(expandedId === barn.id ? null : barn.id)}
              onEdit={() => { setEditBarn(barn); setFormOpen(true); }}
              onDelete={() => setDeletingBarn(barn)}
              readOnly={readOnly}
            />
          ))
        )}
      </CardContent>

      {!readOnly && (
        <>
          <BarnFormDialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) setEditBarn(null);
            }}
            farmId={farmId}
            editBarn={editBarn}
          />
          {deletingBarn && (
            <DeleteBarnDialog
              open={!!deletingBarn}
              onOpenChange={(open) => { if (!open) setDeletingBarn(null); }}
              farmId={farmId}
              barn={deletingBarn}
            />
          )}
        </>
      )}
    </Card>
  );
}

function BarnCard({
  barn,
  farmId,
  allBarns,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  barn: Barn;
  farmId: string;
  allBarns: Barn[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const Icon = barn.barn_type === 'paddock' ? Fence : Warehouse;
  const capacityPercent = barn.capacity ? Math.min(100, ((barn.animal_count || 0) / barn.capacity) * 100) : null;

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="rounded-lg border bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-accent/50 transition-colors rounded-lg">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{barn.name}</span>
                <span className="text-xs text-muted-foreground capitalize">({barn.barn_type})</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {barn.animal_count || 0}{barn.capacity ? ` / ${barn.capacity}` : ''} animals
                </span>
                {capacityPercent !== null && (
                  <Progress value={capacityPercent} className="h-1.5 w-16" />
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t pt-3">
            {barn.description && (
              <p className="text-xs text-muted-foreground mb-3">{barn.description}</p>
            )}
            <BarnAnimalManager barn={barn} farmId={farmId} allBarns={allBarns} readOnly={readOnly} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

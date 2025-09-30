import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, ChevronRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HealthEventsDialogProps {
  farmId: string;
  open: boolean;
  onClose: () => void;
  onNavigateToAnimal: (animalId: string) => void;
}

interface DiagnosisGroup {
  diagnosis: string;
  count: number;
  records: HealthRecord[];
}

interface HealthRecord {
  id: string;
  visit_date: string;
  diagnosis: string;
  treatment: string | null;
  notes: string | null;
  animal_id: string;
  animal: {
    id: string;
    name: string | null;
    ear_tag: string | null;
    breed: string | null;
  };
}

const HealthEventsDialog = ({ farmId, open, onClose, onNavigateToAnimal }: HealthEventsDialogProps) => {
  const [diagnosisGroups, setDiagnosisGroups] = useState<DiagnosisGroup[]>([]);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadHealthEvents();
    }
  }, [farmId, open]);

  const loadHealthEvents = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("health_records")
        .select(`
          id,
          visit_date,
          diagnosis,
          treatment,
          notes,
          animal_id,
          animals!inner(id, name, ear_tag, breed, farm_id)
        `)
        .eq("animals.farm_id", farmId)
        .gte("visit_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("visit_date", { ascending: false });

      if (error) throw error;

      // Group by diagnosis
      const grouped = (data || []).reduce((acc, record) => {
        const diagnosis = record.diagnosis || "Unknown";
        if (!acc[diagnosis]) {
          acc[diagnosis] = [];
        }
        acc[diagnosis].push({
          ...record,
          animal: record.animals as any
        });
        return acc;
      }, {} as Record<string, HealthRecord[]>);

      const groups = Object.entries(grouped).map(([diagnosis, records]) => ({
        diagnosis,
        count: records.length,
        records
      })).sort((a, b) => b.count - a.count);

      setDiagnosisGroups(groups);
    } catch (error: any) {
      toast({
        title: "Error loading health events",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnimalClick = (animalId: string) => {
    onNavigateToAnimal(animalId);
    onClose();
  };

  const handleBack = () => {
    setSelectedDiagnosis(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedDiagnosis && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Activity className="h-5 w-5 text-primary" />
            {selectedDiagnosis ? selectedDiagnosis.diagnosis : "Health Events (Last 30 Days)"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : selectedDiagnosis ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedDiagnosis.count} animal{selectedDiagnosis.count !== 1 ? "s" : ""} affected
            </p>
            {selectedDiagnosis.records.map((record) => (
              <Card
                key={record.id}
                className="cursor-pointer hover:shadow-md transition-all"
                onClick={() => handleAnimalClick(record.animal.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {record.animal.name || "Unnamed"}
                      </CardTitle>
                      <CardDescription>
                        {record.animal.breed} • Tag: {record.animal.ear_tag || "N/A"}
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Visit Date: </span>
                    <span>{new Date(record.visit_date).toLocaleDateString()}</span>
                  </div>
                  {record.treatment && (
                    <div>
                      <span className="text-muted-foreground">Treatment: </span>
                      <span>{record.treatment}</span>
                    </div>
                  )}
                  {record.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes: </span>
                      <span className="text-xs">{record.notes}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : diagnosisGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No health events in the last 30 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diagnosisGroups.map((group) => (
              <Card
                key={group.diagnosis}
                className="cursor-pointer hover:shadow-md transition-all"
                onClick={() => setSelectedDiagnosis(group)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{group.diagnosis}</CardTitle>
                      <CardDescription>
                        {group.count} case{group.count !== 1 ? "s" : ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{group.count}</Badge>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HealthEventsDialog;

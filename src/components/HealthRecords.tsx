import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import { RecordSingleHealthDialog } from "./health-recording/RecordSingleHealthDialog";
import { EditHealthRecordDialog } from "./health-recording/EditHealthRecordDialog";
import { HealthTimeline } from "./health-timeline/HealthTimeline";

interface HealthRecordsProps {
  animalId: string;
  animalName?: string;
  earTag?: string | null;
  farmId?: string;
  livestockType?: string;
  animalFarmEntryDate?: string | null;
  readOnly?: boolean;
}

const HealthRecords = ({
  animalId,
  animalName,
  earTag,
  farmId,
  livestockType,
  animalFarmEntryDate,
  readOnly = false
}: HealthRecordsProps) => {
  // When farmId + livestockType are available, render unified timeline
  if (farmId && livestockType) {
    return (
      <HealthTimeline
        animalId={animalId}
        animalName={animalName}
        earTag={earTag}
        farmId={farmId}
        livestockType={livestockType}
        animalFarmEntryDate={animalFarmEntryDate}
        readOnly={readOnly}
      />
    );
  }

  // Fallback: records-only view when no farmId/livestockType
  return (
    <HealthRecordsOnly
      animalId={animalId}
      animalName={animalName}
      earTag={earTag}
      farmId={farmId}
      animalFarmEntryDate={animalFarmEntryDate}
      readOnly={readOnly}
    />
  );
};

/** Standalone health records card (no preventive, no timeline) */
function HealthRecordsOnly({
  animalId,
  animalName,
  earTag,
  farmId,
  animalFarmEntryDate,
  readOnly = false,
}: Omit<HealthRecordsProps, 'livestockType'>) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadRecords();

    const channel = supabase
      .channel('health_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'health_records',
          filter: `animal_id=eq.${animalId}`
        },
        () => loadRecords()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [animalId]);

  const loadRecords = async () => {
    const cached = await getCachedRecords(animalId);
    if (cached?.health) {
      setRecords(cached.health);
      setLoading(false);
    }
    if (isOnline) {
      const { data, error } = await supabase
        .from("health_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("visit_date", { ascending: false });
      if (error) {
        console.error('Error loading health records:', error);
        showErrorToastLegacy(toast, error, "loading health records");
      } else {
        setRecords(data || []);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Health Records</CardTitle>
          {!readOnly && (
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Record
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No health records yet</p>
        ) : (
          <div className="space-y-3">
            {records.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{new Date(r.visit_date).toLocaleDateString()}</p>
                      {r.diagnosis && <p className="text-sm text-muted-foreground">Diagnosis: {r.diagnosis}</p>}
                      {r.treatment && <p className="text-sm text-muted-foreground">Treatment: {r.treatment}</p>}
                      {r.notes && <p className="text-sm text-muted-foreground mt-2">{r.notes}</p>}
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditingRecord(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {farmId && (
        <RecordSingleHealthDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          animalId={animalId}
          animalName={animalName || earTag || 'Unknown'}
          earTag={earTag}
          farmId={farmId}
          animalFarmEntryDate={animalFarmEntryDate}
          onSuccess={loadRecords}
        />
      )}

      {editingRecord && (
        <EditHealthRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          record={editingRecord}
          animalName={animalName || earTag || 'Unknown'}
          onSuccess={loadRecords}
        />
      )}
    </Card>
  );
}

export default HealthRecords;

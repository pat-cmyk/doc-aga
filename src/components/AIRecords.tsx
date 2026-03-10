import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, CheckCircle, Clock, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScheduleAIDialog } from "./ScheduleAIDialog";
import ConfirmPregnancyDialog from "./ConfirmPregnancyDialog";
import MarkAIPerformedDialog from "./MarkAIPerformedDialog";
import { EditAIRecordDialog } from "./breeding/EditAIRecordDialog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import { 
  BreedingTimeline,
  RecordCalvingDialog, 
  MarkNonReturnButton, 
  RecordHeatReturnButton, 
  MarkVWPEndedButton,
  RecordHeatButton,
  ScheduleAIButton,
  ConfirmPregnancyButton,
  PregnancyFailedButton,
} from "./breeding";
import { RecordHeatDialog } from "./heat-detection/RecordHeatDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { BREEDING_LIFECYCLE_ACTIONS } from "@/lib/urgencyGlossary";

interface AIRecordsProps {
  animalId: string;
  farmId?: string;
  animalName?: string;
  gender?: string;
  livestockType?: string;
  readOnly?: boolean;
}

const AIRecords = ({ animalId, farmId, animalName, gender, livestockType, readOnly = false }: AIRecordsProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const isOnline = useOnlineStatus();

  const loadRecords = async () => {
    const cached = await getCachedRecords(animalId);
    if (cached?.ai) {
      setRecords(cached.ai);
      setLoading(false);
    }
    
    if (isOnline) {
      const { data } = await supabase
        .from("ai_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("scheduled_date", { ascending: false });
      
      if (data) setRecords(data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [animalId]);

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  const isFemale = gender?.toLowerCase() === 'female';

  // Find latest performed AI date for timing guards
  const lastPerformedAI = records.find(r => r.performed_date);
  const lastAIDate = lastPerformedAI?.performed_date || undefined;

  // For females with farmId: unified timeline + lifecycle actions
  if (isFemale && farmId) {
    return (
      <div className="space-y-4">
        {/* Unified Breeding Timeline */}
        <BreedingTimeline
          animalId={animalId}
          farmId={farmId}
          readOnly={readOnly}
        />

        {/* Lifecycle Actions - all 8 milestones */}
        {!readOnly && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lifecycle Actions</CardTitle>
            </CardHeader>
            <CardContent>
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <RecordHeatButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.record_heat.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ScheduleAIButton
                        animalId={animalId}
                        farmId={farmId}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.schedule_ai.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <RecordCalvingDialog
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        livestockType={livestockType}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.record_calving.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <MarkNonReturnButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        lastAIDate={lastAIDate}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.non_return.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <ConfirmPregnancyButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.pregnancy_confirmed.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <PregnancyFailedButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.pregnancy_failed.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <RecordHeatReturnButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.heat_return.description}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <MarkVWPEndedButton
                        animalId={animalId}
                        farmId={farmId}
                        animalName={animalName}
                        onSuccess={loadRecords}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-sm">
                    <p>{BREEDING_LIFECYCLE_ACTIONS.vwp_ended.description}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            </CardContent>
          </Card>
        )}

        {/* Edit AI Record Dialog (kept for editing existing records) */}
        {editingRecord && (
          <EditAIRecordDialog
            open={!!editingRecord}
            onOpenChange={(open) => !open && setEditingRecord(null)}
            record={editingRecord}
            animalName={animalName || 'Unknown'}
            onSuccess={loadRecords}
          />
        )}
      </div>
    );
  }

  // For males or no farmId: show AI records list only
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI/Breeding Records</CardTitle>
          {!readOnly && (
            <ScheduleAIDialog 
              animalId={animalId} 
              farmId={farmId}
              onSuccess={loadRecords} 
              disabled={!isOnline}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No AI records yet</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Scheduled: {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : "N/A"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!r.performed_date && (
                          <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>
                        )}
                        {r.performed_date && !r.pregnancy_confirmed && (
                          <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Performed</Badge>
                        )}
                        {r.pregnancy_confirmed && (
                          <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Pregnant</Badge>
                        )}
                        {!readOnly && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRecord(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {r.performed_date && <p className="text-sm text-muted-foreground">Performed: {new Date(r.performed_date).toLocaleDateString()}</p>}
                    {r.technician && <p className="text-sm text-muted-foreground">Technician: {r.technician}</p>}
                    {r.semen_code && <p className="text-sm text-muted-foreground">Semen Code: <span className="font-mono">{r.semen_code}</span></p>}
                    {r.notes && <p className="text-sm text-muted-foreground">Notes: {r.notes}</p>}
                    {r.pregnancy_confirmed && r.expected_delivery_date && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Expected Delivery: {new Date(r.expected_delivery_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {!readOnly && !r.performed_date && r.scheduled_date && (
                      <div className="mt-2">
                        <MarkAIPerformedDialog recordId={r.id} animalId={animalId} farmId={farmId || ''} scheduledDate={r.scheduled_date} onSuccess={loadRecords} />
                      </div>
                    )}
                    {!readOnly && r.performed_date && !r.pregnancy_confirmed && (
                      <div className="mt-2">
                        <ConfirmPregnancyDialog recordId={r.id} animalId={animalId} farmId={farmId || ''} performedDate={r.performed_date} onSuccess={loadRecords} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      {editingRecord && (
        <EditAIRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          record={editingRecord}
          animalName={animalName || 'Unknown'}
          onSuccess={loadRecords}
        />
      )}
    </Card>
  );
};

export default AIRecords;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Calendar, CheckCircle, Clock, Flame, Dna } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScheduleAIDialog } from "./ScheduleAIDialog";
import ConfirmPregnancyDialog from "./ConfirmPregnancyDialog";
import MarkAIPerformedDialog from "./MarkAIPerformedDialog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import { HeatHistoryTab } from "./heat-detection/HeatHistoryTab";

interface AIRecordsProps {
  animalId: string;
  farmId?: string;
  animalName?: string;
  gender?: string;
}

const AIRecords = ({ animalId, farmId, animalName, gender }: AIRecordsProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  const loadRecords = async () => {
    // Try cache first
    const cached = await getCachedRecords(animalId);
    if (cached?.ai) {
      setRecords(cached.ai);
      setLoading(false);
    }
    
    // Fetch fresh if online
    if (isOnline) {
      const { data } = await supabase
        .from("ai_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("scheduled_date", { ascending: false });
      
      if (data) {
        setRecords(data);
      }
    }
    
    // Always set loading to false, even if offline with no cache
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [animalId]);

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  // AI Records Content
  const aiRecordsContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI/Breeding Records</CardTitle>
          <ScheduleAIDialog 
            animalId={animalId} 
            onSuccess={loadRecords} 
            disabled={!isOnline}
          />
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
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            Scheduled
                          </Badge>
                        )}
                        {r.performed_date && !r.pregnancy_confirmed && (
                          <Badge variant="outline">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Performed
                          </Badge>
                        )}
                        {r.pregnancy_confirmed && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Pregnant
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {r.performed_date && (
                      <p className="text-sm text-muted-foreground">
                        Performed: {new Date(r.performed_date).toLocaleDateString()}
                      </p>
                    )}
                    
                    {r.technician && (
                      <p className="text-sm text-muted-foreground">
                        Technician: {r.technician}
                      </p>
                    )}
                    
                    {r.semen_code && (
                      <p className="text-sm text-muted-foreground">
                        Semen Code: <span className="font-mono">{r.semen_code}</span>
                      </p>
                    )}
                    
                    {r.notes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {r.notes}
                      </p>
                    )}
                    
                    {r.pregnancy_confirmed && r.expected_delivery_date && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded-md">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                          Expected Delivery: {new Date(r.expected_delivery_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    
                    {!r.performed_date && r.scheduled_date && (
                      <div className="mt-2">
                        <MarkAIPerformedDialog 
                          recordId={r.id}
                          scheduledDate={r.scheduled_date}
                          onSuccess={loadRecords}
                        />
                      </div>
                    )}
                    
                    {r.performed_date && !r.pregnancy_confirmed && (
                      <div className="mt-2">
                        <ConfirmPregnancyDialog 
                          recordId={r.id}
                          performedDate={r.performed_date}
                          onSuccess={loadRecords}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // If female and has farmId, show with heat detection sub-tab
  const isFemale = gender?.toLowerCase() === 'female';
  
  if (isFemale && farmId) {
    return (
      <Tabs defaultValue="ai-records" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-records" className="flex items-center gap-2">
            <Dna className="h-4 w-4" />
            AI Records
          </TabsTrigger>
          <TabsTrigger value="heat" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Heat Detection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-records">
          {aiRecordsContent}
        </TabsContent>

        <TabsContent value="heat">
          <HeatHistoryTab 
            animalId={animalId} 
            farmId={farmId} 
            animalName={animalName}
            gender={gender}
          />
        </TabsContent>
      </Tabs>
    );
  }

  // For males or when farmId not provided, just show AI records
  return aiRecordsContent;
};

export default AIRecords;

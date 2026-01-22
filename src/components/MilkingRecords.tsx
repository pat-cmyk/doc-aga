import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Loader2, Sun, Moon, Pencil, ChevronDown, ChevronUp, History, Trash2, RotateCcw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import { getCachedRecords } from "@/lib/dataCache";
import { RecordSingleMilkDialog } from "@/components/milk-recording/RecordSingleMilkDialog";
import { EditMilkRecordDialog } from "@/components/milk-recording/EditMilkRecordDialog";
import { DeleteMilkRecordFromProfileDialog } from "@/components/milk-recording/DeleteMilkRecordFromProfileDialog";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { hapticNotification } from "@/lib/haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";

interface MilkRecord {
  id: string;
  animal_id: string;
  record_date: string;
  liters: number;
  session: 'AM' | 'PM';
  created_at: string;
}

interface MilkingRecordsProps {
  animalId: string;
  readOnly?: boolean;
}

const MilkingRecords = ({ animalId, readOnly = false }: MilkingRecordsProps) => {
  const [records, setRecords] = useState<MilkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<"all" | "cycle" | "month">("all");
  const [latestCalvingDate, setLatestCalvingDate] = useState<Date | null>(null);
  const [animalGender, setAnimalGender] = useState<string | null>(null);
  const [animalName, setAnimalName] = useState<string | null>(null);
  const [earTag, setEarTag] = useState<string | null>(null);
  const [animalFarmId, setAnimalFarmId] = useState<string | null>(null);
  const [animalFarmEntryDate, setAnimalFarmEntryDate] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<MilkRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<MilkRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pendingDeletesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadAnimalInfo();
    loadRecords();
    loadLatestCalvingDate();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('milking_records_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'milking_records',
          filter: `animal_id=eq.${animalId}`
        },
        () => {
          loadRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [animalId]);

  const loadAnimalInfo = async () => {
    const { data } = await supabase
      .from("animals")
      .select("gender, farm_id, farm_entry_date, name, ear_tag")
      .eq("id", animalId)
      .single();
    setAnimalGender(data?.gender || null);
    setAnimalFarmId(data?.farm_id || null);
    setAnimalFarmEntryDate(data?.farm_entry_date || null);
    setAnimalName(data?.name || null);
    setEarTag(data?.ear_tag || null);
  };

  const loadLatestCalvingDate = async () => {
    const { data } = await supabase
      .from("animals")
      .select("birth_date")
      .eq("mother_id", animalId)
      .order("birth_date", { ascending: false })
      .limit(1);
    
    if (data && data.length > 0 && data[0].birth_date) {
      setLatestCalvingDate(new Date(data[0].birth_date));
    }
  };

  const loadRecords = async () => {
    // Try cache first
    const cached = await getCachedRecords(animalId);
    if (cached?.milking) {
      setRecords(cached.milking as MilkRecord[]);
      setLoading(false);
    }
    
    // Fetch fresh if online
    if (isOnline) {
      const { data } = await supabase
        .from("milking_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("record_date", { ascending: false });
      setRecords((data || []) as MilkRecord[]);
    }
    
    setLoading(false);
  };

  // Reload records when dialog closes (in case new record was added)
  const handleDialogChange = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      loadRecords();
    }
  };

  const handleEditSuccess = () => {
    loadRecords();
  };

  const handleDeleteWithUndo = async (record: MilkRecord) => {
    // Optimistically remove from UI
    setRecords(prev => prev.filter(r => r.id !== record.id));
    setDeletingRecord(null);
    
    // Set timeout for actual deletion (30 seconds)
    const timeoutId = setTimeout(async () => {
      try {
        // Delete from milk_inventory first (FK constraint)
        await supabase.from("milk_inventory").delete().eq("milking_record_id", record.id);
        
        // Perform actual database deletion
        await supabase.from("milking_records").delete().eq("id", record.id);
        
        // Clean up pending delete tracking
        pendingDeletesRef.current.delete(record.id);
        
        // Refetch queries
        await queryClient.refetchQueries({ queryKey: ['milk-inventory', animalFarmId] });
      } catch (error) {
        console.error('Error deleting milk record:', error);
      }
    }, 30000); // 30 second window
    
    // Track pending delete
    pendingDeletesRef.current.set(record.id, timeoutId);
    
    // Show toast with undo action
    toast({
      title: "Record deleted",
      description: `${record.liters}L (${record.session}) removed`,
      action: (
        <ToastAction altText="Undo" onClick={() => handleUndoDelete(record, timeoutId)}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Undo
        </ToastAction>
      ),
      duration: 30000, // Match the delete timer
    });
  };

  const handleUndoDelete = (record: MilkRecord, timeoutId: NodeJS.Timeout) => {
    // Cancel the pending delete
    clearTimeout(timeoutId);
    
    // Restore record to UI
    setRecords(prev => [...prev, record].sort((a, b) => 
      new Date(b.record_date).getTime() - new Date(a.record_date).getTime()
    ));
    
    // Clean up tracking
    pendingDeletesRef.current.delete(record.id);
    
    hapticNotification('success');
    toast({
      title: "Record restored",
      description: `${record.liters}L (${record.session}) has been restored`,
    });
  };

  // Cleanup pending deletes on unmount
  useEffect(() => {
    return () => {
      pendingDeletesRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  if (loading) return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;

  // Show message for male animals
  if (animalGender?.toLowerCase() === 'male') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Milking Production</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Milking records are only available for female cattle.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getFilteredRecords = () => {
    const now = new Date();
    
    switch (filterPeriod) {
      case "cycle":
        if (!latestCalvingDate) return records;
        return records.filter(r => new Date(r.record_date) >= latestCalvingDate);
      
      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return records.filter(r => new Date(r.record_date) >= startOfMonth);
      
      case "all":
      default:
        return records;
    }
  };

  const filteredRecords = getFilteredRecords();
  
  // For chart, sort ascending
  const chartRecords = [...filteredRecords].sort((a, b) => 
    new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
  );
  
  const chartData = chartRecords.map(r => ({
    date: format(new Date(r.record_date), "MMM d"),
    liters: r.liters
  }));

  const chartConfig = {
    liters: {
      label: "Liters",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Milking Production</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {!readOnly && (
              <Button 
                onClick={() => setShowDialog(true)} 
                className="w-full sm:w-auto min-h-[48px]"
              >
                <Plus className="h-5 w-5 mr-2" />Add Record
              </Button>
            )}
            
            <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as "all" | "cycle" | "month")}>
              <SelectTrigger className="w-full sm:w-[180px] min-h-[48px] sm:ml-auto">
                <SelectValue placeholder="Filter by period" />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="all">All-Time</SelectItem>
                <SelectItem value="cycle" disabled={!latestCalvingDate}>This Cycle</SelectItem>
                <SelectItem value="month">Month-to-Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {records.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground px-1">
                Showing {filteredRecords.length} records {filterPeriod === "all" ? "(all-time)" : filterPeriod === "cycle" ? "(current cycle)" : "(this month)"}
              </div>
              <ChartContainer key={filterPeriod} config={chartConfig} className="h-[280px] sm:h-[320px] w-full">
                <LineChart 
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: isMobile ? 60 : 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs" 
                    tick={{ fontSize: isMobile ? 9 : 11 }}
                    tickMargin={isMobile ? 15 : 8}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 50 : 30}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fontSize: isMobile ? 9 : 11 }} 
                    label={isMobile ? undefined : { value: 'Liters', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} 
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="liters" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                </LineChart>
              </ChartContainer>

              {/* Records History */}
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-2 py-2 h-auto">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <History className="h-4 w-4" />
                      Records History
                    </span>
                    {historyOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {filteredRecords.map((record) => (
                      <div 
                        key={record.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                            {record.session === 'AM' ? (
                              <Sun className="h-4 w-4 text-amber-500" />
                            ) : (
                              <Moon className="h-4 w-4 text-indigo-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {format(new Date(record.record_date), "MMM d, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.session === 'AM' ? 'Morning' : 'Evening'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{record.liters}L</span>
                          {!readOnly && (
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingRecord(record)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setDeletingRecord(record)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No milking records yet. Add your first record to see the production chart.
            </div>
          )}
        </CardContent>
      </Card>

      {animalFarmId && (
        <RecordSingleMilkDialog
          open={showDialog}
          onOpenChange={handleDialogChange}
          animalId={animalId}
          animalName={animalName}
          earTag={earTag}
          farmId={animalFarmId}
          farmEntryDate={animalFarmEntryDate}
        />
      )}

      {editingRecord && animalFarmId && (
        <EditMilkRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          record={editingRecord}
          animalName={animalName}
          farmId={animalFarmId}
          onSuccess={handleEditSuccess}
        />
      )}

      {deletingRecord && animalFarmId && (
        <DeleteMilkRecordFromProfileDialog
          open={!!deletingRecord}
          onOpenChange={(open) => !open && setDeletingRecord(null)}
          record={deletingRecord}
          animalName={animalName}
          onDelete={handleDeleteWithUndo}
        />
      )}
    </>
  );
};

export default MilkingRecords;

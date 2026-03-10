import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Scale, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useResponsiveChart } from "@/hooks/useResponsiveChart";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { BCSHistoryChart } from "@/components/body-condition/BCSHistoryChart";
import { RecordSingleWeightDialog } from "@/components/weight-recording/RecordSingleWeightDialog";
import { EditWeightRecordDialog } from "@/components/weight-recording/EditWeightRecordDialog";
import { DeleteWeightRecordDialog } from "@/components/weight-recording/DeleteWeightRecordDialog";
import { ADGBadge } from "@/components/weight-recording/ADGBadge";
import { calculateADG, calculateOverallADG, type ADGResult } from "@/lib/growthMetrics";

interface WeightRecord {
  id: string;
  animal_id: string;
  weight_kg: number;
  measurement_date: string;
  measurement_method: string | null;
  notes: string | null;
  created_at: string;
}

interface WeightRecordsProps {
  animalId: string;
  animalName: string;
  animalBirthDate?: string;
  animalFarmEntryDate?: string;
  livestockType?: string;
  gender?: string | null;
  lifeStage?: string | null;
  farmId: string;
  readOnly?: boolean;
}

export function WeightRecords({ animalId, animalName, animalBirthDate, animalFarmEntryDate, livestockType, gender, lifeStage, farmId, readOnly = false }: WeightRecordsProps) {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<WeightRecord | null>(null);
  const { isMobile, fontSize, xAxisProps, margin } = useResponsiveChart({ size: 'small' });
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  useEffect(() => {
    loadWeightRecords();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('weight_records_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'weight_records',
          filter: `animal_id=eq.${animalId}`
        },
        () => {
          console.log('New weight record detected, reloading...');
          loadWeightRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [animalId]);

  const loadWeightRecords = async () => {
    setLoading(true);
    
    // Try cache first
    const cached = await getCachedRecords(animalId);
    if (cached?.weight) {
      setRecords(cached.weight);
      setLoading(false);
    }
    
    // Fetch fresh if online
    if (isOnline) {
      const { data, error } = await supabase
        .from("weight_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("measurement_date", { ascending: false });

      if (error) {
        console.error("Error loading weight records:", error);
      } else {
        setRecords(data || []);
      }
    }
    
    // Always set loading to false, even if offline with no cache
    setLoading(false);
  };

  const handleDeleteWeightRecord = async (record: WeightRecord) => {
    try {
      const { error } = await supabase
        .from('weight_records')
        .delete()
        .eq('id', record.id);
      if (error) throw error;

      // If this was the latest record, update animal's current_weight_kg
      const { data: latest } = await supabase
        .from('weight_records')
        .select('weight_kg')
        .eq('animal_id', animalId)
        .order('measurement_date', { ascending: false })
        .limit(1);

      await supabase
        .from('animals')
        .update({ current_weight_kg: latest?.[0]?.weight_kg ?? null })
        .eq('id', animalId);

      toast({ title: "Weight record deleted" });
      loadWeightRecords();
    } catch (error: any) {
      console.error('[DeleteWeightRecord] Failed:', error);
      showErrorToastLegacy(toast, error, 'deleting weight record');
    }
  };

  const calculateAgeInMonths = (measurementDate: string) => {
    if (!animalBirthDate) return null;
    const birth = new Date(animalBirthDate);
    const measurement = new Date(measurementDate);
    const diffTime = measurement.getTime() - birth.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
    return Math.ceil(diffMonths); // Round up
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const dataPoint = chartData.find((d: any) => d.date === payload.value);
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12}>
          {payload.value}
        </text>
        {dataPoint?.ageMonths && (
          <text x={0} y={0} dy={32} textAnchor="middle" fill="#999" fontSize={10}>
            {dataPoint.ageMonths}mo
          </text>
        )}
      </g>
    );
  };

  // Prepare chart data
  const chartData = [...records]
    .reverse()
    .map(r => ({
      date: format(new Date(r.measurement_date), "MMM dd"),
      weight: r.weight_kg,
      ageMonths: calculateAgeInMonths(r.measurement_date),
    }));

  const latestWeight = records[0]?.weight_kg;
  const previousWeight = records[1]?.weight_kg;
  const weightChange = latestWeight && previousWeight ? latestWeight - previousWeight : null;

  // Calculate overall ADG from all records
  const overallADG = useMemo(() => {
    if (records.length < 2) return null;
    return calculateOverallADG(
      records.map(r => ({ weight_kg: r.weight_kg, measurement_date: r.measurement_date })),
      livestockType || 'cattle',
      gender || 'female',
      lifeStage
    );
  }, [records, livestockType, gender, lifeStage]);

  // Calculate ADG for each record (compared to previous)
  const recordsWithADG = useMemo(() => {
    // Records are sorted descending by date, so reverse for calculations
    const sortedAsc = [...records].reverse();
    
    return records.map((record, index) => {
      // Find index in ascending sorted array
      const ascIndex = sortedAsc.findIndex(r => r.id === record.id);
      
      if (ascIndex <= 0) return { ...record, adgFromPrevious: null };
      
      const previousRecord = sortedAsc[ascIndex - 1];
      const adgFromPrevious = calculateADG(
        { weight_kg: record.weight_kg, measurement_date: record.measurement_date },
        { weight_kg: previousRecord.weight_kg, measurement_date: previousRecord.measurement_date },
        livestockType || 'cattle',
        gender || 'female',
        lifeStage
      );
      
      return { ...record, adgFromPrevious };
    });
  }, [records, livestockType, gender, lifeStage]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Current Weight Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 sm:justify-between pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Scale className="h-5 w-5" />
            Current Weight
          </CardTitle>
          {!readOnly && (
            <>
              <Button 
                size="sm" 
                className="min-h-[48px]"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Record Weight
              </Button>
              <RecordSingleWeightDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                animalId={animalId}
                animalName={animalName}
                farmId={farmId}
                livestockType={livestockType}
                gender={gender}
                lifeStage={lifeStage}
                animalFarmEntryDate={animalFarmEntryDate}
                onSuccess={loadWeightRecords}
              />
            </>
          )}
        </CardHeader>
        <CardContent className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl sm:text-3xl font-bold">
                {latestWeight ? `${latestWeight} kg` : "No data"}
              </div>
              {records[0]?.measurement_date && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Last: {format(new Date(records[0].measurement_date), "MMM dd, yyyy")}
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              {weightChange !== null && (
                <div className={`flex items-center justify-end gap-1 text-sm sm:text-base ${weightChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-medium">
                    {weightChange >= 0 ? "+" : ""}{weightChange.toFixed(1)} kg
                  </span>
                </div>
              )}
              {overallADG && (
                <div className="flex items-center justify-end gap-1 text-xs sm:text-sm text-muted-foreground">
                  <span>ADG:</span>
                  <span className="font-medium text-foreground">{overallADG.adgGrams} g/day</span>
                  <span>({overallADG.daysBetween}d)</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weight Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Weight Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
              <LineChart 
                data={chartData}
                margin={{ ...margin, bottom: isMobile ? 50 : 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize }}
                  tickMargin={xAxisProps.tickMargin}
                  angle={xAxisProps.angle}
                  textAnchor={xAxisProps.textAnchor}
                  height={isMobile ? 50 : 40}
                />
                <YAxis tick={{ fontSize }} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weight History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weight History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : recordsWithADG.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No weight records yet. Click "Record Weight" to add the first measurement.
            </p>
          ) : isMobile ? (
            <div className="space-y-3">
              {recordsWithADG.map((record) => (
                <Card key={record.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-xl text-primary">
                          {record.weight_kg} kg
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.measurement_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-xs text-muted-foreground capitalize">
                            {record.measurement_method?.replace("_", " ") || "—"}
                          </div>
                          <ADGBadge adgResult={record.adgFromPrevious} showDays size="sm" />
                        </div>
                        {!readOnly && (
                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingRecord(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingRecord(record)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                        {record.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>ADG</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Notes</TableHead>
                    {!readOnly && <TableHead className="w-[50px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsWithADG.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.measurement_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-medium">{record.weight_kg} kg</TableCell>
                      <TableCell>
                        <ADGBadge adgResult={record.adgFromPrevious} showDays size="sm" />
                      </TableCell>
                      <TableCell className="capitalize">
                        {record.measurement_method?.replace("_", " ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.notes || "—"}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingRecord(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingRecord(record)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BCS History Chart */}
      <div className="mt-6 pt-6 border-t">
        <BCSHistoryChart animalId={animalId} farmId={farmId} />
      </div>

      {/* Edit Weight Record Dialog */}
      {editingRecord && (
        <EditWeightRecordDialog
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
          record={editingRecord}
          animalName={animalName}
          onSuccess={loadWeightRecords}
        />
      )}

      {/* Delete Weight Record Dialog */}
      {deletingRecord && (
        <DeleteWeightRecordDialog
          open={!!deletingRecord}
          onOpenChange={(open) => !open && setDeletingRecord(null)}
          record={deletingRecord}
          animalName={animalName}
          isLatest={records[0]?.id === deletingRecord.id}
          onDelete={handleDeleteWeightRecord}
        />
      )}
    </div>
  );
}

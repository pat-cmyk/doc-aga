import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Scale, TrendingUp, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import { validateRecordDate } from "@/lib/recordValidation";
import { WeightHintBadge } from "@/components/ui/weight-hint-badge";
import { BCSHistoryChart } from "@/components/body-condition/BCSHistoryChart";

interface WeightRecord {
  id: string;
  weight_kg: number;
  measurement_date: string;
  measurement_method: string | null;
  notes: string | null;
  created_at: string;
}

interface WeightRecordsProps {
  animalId: string;
  animalBirthDate?: string;
  animalFarmEntryDate?: string;
  livestockType?: string;
  gender?: string | null;
  lifeStage?: string | null;
}

export function WeightRecords({ animalId, animalBirthDate, animalFarmEntryDate, livestockType, gender, lifeStage }: WeightRecordsProps) {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isOnline = useOnlineStatus();
  
  // Form state
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("scale");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        toast.error("Failed to load weight records");
      } else {
        setRecords(data || []);
      }
    }
    
    // Always set loading to false, even if offline with no cache
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    // Validate record date against farm entry date
    const dateValidation = validateRecordDate(date, { farm_entry_date: animalFarmEntryDate });
    if (!dateValidation.valid) {
      toast.error(dateValidation.message || "Invalid date");
      return;
    }

    setSubmitting(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("weight_records").insert({
      animal_id: animalId,
      weight_kg: weightNum,
      measurement_date: date,
      measurement_method: method,
      notes: notes.trim() || null,
      recorded_by: user?.id,
    });

    if (error) {
      console.error("Error adding weight record:", error);
      toast.error("Failed to add weight record");
    } else {
      toast.success("Weight record added");
      setDialogOpen(false);
      setWeight("");
      setNotes("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      loadWeightRecords();
    }
    
    setSubmitting(false);
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

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Current Weight Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 sm:justify-between pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Scale className="h-5 w-5" />
            Current Weight
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="min-h-[48px]"
                disabled={!isOnline}
                title={!isOnline ? "Available when online" : ""}
              >
                <Plus className="h-5 w-5 mr-2" />
                Record Weight
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-lg h-[100dvh] sm:h-auto overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record New Weight</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                  />
                  {livestockType && (
                    <WeightHintBadge
                      livestockType={livestockType}
                      gender={gender}
                      lifeStage={lifeStage}
                      weightType="current"
                      className="mt-1"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="date">Measurement Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="method">Measurement Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scale">Scale</SelectItem>
                      <SelectItem value="tape_measure">Tape Measure</SelectItem>
                      <SelectItem value="visual_estimate">Visual Estimate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional observations..."
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full min-h-[48px]">
                  {submitting ? "Saving..." : "Save Weight Record"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
            {weightChange !== null && (
              <div className={`flex items-center gap-1 text-sm sm:text-base ${weightChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">
                  {weightChange >= 0 ? "+" : ""}{weightChange.toFixed(1)} kg
                </span>
              </div>
            )}
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={<CustomXAxisTick />} height={60} />
                <YAxis tick={{ fontSize: 11 }} />
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
          ) : records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No weight records yet. Click "Record Weight" to add the first measurement.
            </p>
          ) : isMobile ? (
            <div className="space-y-3">
              {records.map((record) => (
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
                      <div className="text-xs text-muted-foreground capitalize">
                        {record.measurement_method?.replace("_", " ") || "—"}
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
                    <TableHead>Method</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.measurement_date), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-medium">{record.weight_kg} kg</TableCell>
                      <TableCell className="capitalize">
                        {record.measurement_method?.replace("_", " ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.notes || "—"}
                      </TableCell>
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
        <BCSHistoryChart animalId={animalId} />
      </div>
    </div>
  );
}

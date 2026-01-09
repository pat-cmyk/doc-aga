import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Wheat } from "lucide-react";
import { format } from "date-fns";
import { RecordSingleFeedDialog } from "@/components/feed-recording/RecordSingleFeedDialog";

interface FeedingRecord {
  id: string;
  animal_id: string;
  feed_type: string | null;
  kilograms: number | null;
  notes: string | null;
  record_datetime: string;
  created_at: string;
  created_by: string | null;
}

interface FeedingRecordsProps {
  animalId: string;
  animalName?: string;
  farmId?: string;
  animalFarmEntryDate?: string | null;
  readOnly?: boolean;
}

export function FeedingRecords({ 
  animalId, 
  animalName = "Animal",
  farmId,
  animalFarmEntryDate,
  readOnly = false 
}: FeedingRecordsProps) {
  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolvedFarmId, setResolvedFarmId] = useState<string | null>(farmId || null);
  const [resolvedFarmEntryDate, setResolvedFarmEntryDate] = useState<string | null>(animalFarmEntryDate || null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadFeedingRecords();
    
    // Resolve farm data if not provided via props
    if (!farmId || !animalFarmEntryDate) {
      loadAnimalFarmData();
    }

    // Set up realtime subscription
    const channel = supabase
      .channel(`feeding_records:${animalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feeding_records",
          filter: `animal_id=eq.${animalId}`,
        },
        () => {
          loadFeedingRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [animalId]);

  const loadAnimalFarmData = async () => {
    try {
      const { data: animal } = await supabase
        .from("animals")
        .select("farm_id, farm_entry_date")
        .eq("id", animalId)
        .maybeSingle();

      if (animal) {
        if (!farmId) setResolvedFarmId(animal.farm_id);
        if (!animalFarmEntryDate) setResolvedFarmEntryDate(animal.farm_entry_date);
      }
    } catch (error) {
      console.error("Error loading animal farm data:", error);
    }
  };

  const loadFeedingRecords = async () => {
    try {
      // Try cache first
      const cached = await getCachedRecords(animalId);
      if (cached?.feeding) {
        setRecords(cached.feeding);
        setLoading(false);
      }
      
      // Fetch fresh if online
      if (isOnline) {
        const { data, error } = await supabase
          .from("feeding_records")
          .select("*")
          .eq("animal_id", animalId)
          .order("record_datetime", { ascending: false });

        if (error) throw error;
        setRecords(data || []);
      }
    } catch (error) {
      console.error("Error loading feeding records:", error);
      toast({
        title: "Error",
        description: "Failed to load feeding records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate today's total
  const todayTotal = records
    .filter(
      (r) =>
        format(new Date(r.record_datetime), "yyyy-MM-dd") ===
        format(new Date(), "yyyy-MM-dd")
    )
    .reduce((sum, r) => sum + (r.kilograms || 0), 0);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Today's Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
          <CardTitle className="text-base sm:text-lg">Today's Feed</CardTitle>
          <Wheat className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pb-3 sm:pb-6">
          <div className="text-2xl sm:text-3xl font-bold">{todayTotal.toFixed(2)} kg</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total feed given today
          </p>
        </CardContent>
      </Card>

      {/* Record Feed Button + Dialog */}
      {!readOnly && resolvedFarmId && (
        <>
          <Button 
            className="w-full min-h-[48px] text-base"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Record Feed
          </Button>
          
          <RecordSingleFeedDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            animalId={animalId}
            animalName={animalName}
            farmId={resolvedFarmId}
            animalFarmEntryDate={resolvedFarmEntryDate}
            onSuccess={loadFeedingRecords}
          />
        </>
      )}

      {/* Feeding History */}
      <Card>
        <CardHeader>
          <CardTitle>Feeding History</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No feeding records yet
            </p>
          ) : isMobile ? (
            <div className="space-y-3">
              {records.map((record) => (
                <Card key={record.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-base">
                          {record.feed_type || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.record_datetime), "MMM d, yyyy")} at{" "}
                          {format(new Date(record.record_datetime), "h:mm a")}
                        </p>
                      </div>
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full">
                        <span className="font-bold text-base">
                          {record.kilograms?.toFixed(2) || "0.00"} kg
                        </span>
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
                    <TableHead>Time</TableHead>
                    <TableHead>Feed Type</TableHead>
                    <TableHead className="text-right">Amount (kg)</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {format(new Date(record.record_datetime), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(record.record_datetime), "h:mm a")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.feed_type || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.kilograms?.toFixed(2) || "0.00"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {record.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

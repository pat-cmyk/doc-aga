import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedRecords } from "@/lib/dataCache";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
}

export function FeedingRecords({ animalId }: FeedingRecordsProps) {
  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isOnline = useOnlineStatus();

  // Form state
  const [feedType, setFeedType] = useState("");
  const [kilograms, setKilograms] = useState("");
  const [recordDate, setRecordDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadFeedingRecords();

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
      // Always set loading to false, even if offline with no cache
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedType.trim() || !kilograms) {
      toast({
        title: "Validation Error",
        description: "Please fill in feed type and kilograms",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("feeding_records").insert({
        animal_id: animalId,
        feed_type: feedType.trim(),
        kilograms: parseFloat(kilograms),
        notes: notes.trim() || null,
        record_datetime: new Date(recordDate).toISOString(),
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feeding record added successfully",
      });

      // Reset form
      setFeedType("");
      setKilograms("");
      setNotes("");
      setRecordDate(format(new Date(), "yyyy-MM-dd"));
      setDialogOpen(false);
    } catch (error) {
      console.error("Error adding feeding record:", error);
      toast({
        title: "Error",
        description: "Failed to add feeding record",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

      {/* Record Feed Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            className="w-full min-h-[48px] text-base"
            disabled={!isOnline}
            title={!isOnline ? "Available when online" : ""}
          >
            <Plus className="h-5 w-5 mr-2" />
            Record Feed
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-full sm:max-w-lg h-[100dvh] sm:h-auto overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Feeding</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recordDate">Date</Label>
              <Input
                id="recordDate"
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedType">Feed Type</Label>
              <Input
                id="feedType"
                placeholder="e.g., Hay, Silage, Concentrate"
                value={feedType}
                onChange={(e) => setFeedType(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kilograms">Kilograms</Label>
              <Input
                id="kilograms"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={kilograms}
                onChange={(e) => setKilograms(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 min-h-[48px]"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[48px]" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Record"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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

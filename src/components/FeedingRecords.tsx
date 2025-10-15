import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      const { data, error } = await supabase
        .from("feeding_records")
        .select("*")
        .eq("animal_id", animalId)
        .order("record_datetime", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
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
    <div className="space-y-6">
      {/* Today's Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Today's Feed</CardTitle>
          <Wheat className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{todayTotal.toFixed(2)} kg</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total feed given today
          </p>
        </CardContent>
      </Card>

      {/* Record Feed Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Record Feed
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Feeding</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
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
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
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

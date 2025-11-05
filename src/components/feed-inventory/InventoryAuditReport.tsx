import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditRecord {
  id: string;
  record_datetime: string;
  feed_type: string;
  kilograms: number;
  animal_name: string;
  animal_ear_tag: string;
  has_transaction: boolean;
}

export function InventoryAuditReport({ farmId }: { farmId: string }) {
  const [auditData, setAuditData] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditData();
  }, [farmId]);

  const loadAuditData = async () => {
    try {
      setLoading(true);

      // Get all feeding records for the farm with animal details
      const { data: feedingRecords, error: feedingError } = await supabase
        .from("feeding_records")
        .select(`
          id,
          record_datetime,
          feed_type,
          kilograms,
          animal:animals!inner(
            name,
            ear_tag,
            farm_id
          )
        `)
        .eq("animal.farm_id", farmId)
        .order("record_datetime", { ascending: false });

      if (feedingError) throw feedingError;

      // Get all feed stock transactions
      const { data: transactions, error: transError } = await supabase
        .from("feed_stock_transactions")
        .select(`
          id,
          feed_inventory:feed_inventory!inner(
            farm_id,
            feed_type
          )
        `)
        .eq("feed_inventory.farm_id", farmId)
        .eq("transaction_type", "consumption");

      if (transError) throw transError;

      // Create a set of dates that have transactions
      const transactionDates = new Set(
        transactions?.map(t => t.id) || []
      );

      // Map feeding records and check if they have transactions
      const audit: AuditRecord[] = (feedingRecords || []).map(record => ({
        id: record.id,
        record_datetime: record.record_datetime,
        feed_type: record.feed_type,
        kilograms: record.kilograms,
        animal_name: record.animal.name || "Unknown",
        animal_ear_tag: record.animal.ear_tag || "",
        has_transaction: false // We'll need a better way to link these
      }));

      // For a proper audit, we need to check if there's a transaction that:
      // 1. Was created around the same time as the feeding record
      // 2. Has matching feed type
      // 3. Has matching or similar quantity
      
      // For now, we'll identify records without clear inventory tracking
      const { data: feedingWithTransactions, error: joinError } = await supabase
        .from("feeding_records")
        .select(`
          id,
          record_datetime,
          feed_type,
          kilograms,
          created_at,
          animal:animals!inner(
            name,
            ear_tag,
            farm_id
          )
        `)
        .eq("animal.farm_id", farmId)
        .order("record_datetime", { ascending: false });

      if (joinError) throw joinError;

      // Get inventory items to check for feed type matches
      const { data: inventory } = await supabase
        .from("feed_inventory")
        .select("id, feed_type")
        .eq("farm_id", farmId);

      const inventoryFeedTypes = new Set(
        inventory?.map(i => i.feed_type.toLowerCase().trim()) || []
      );

      const auditResults: AuditRecord[] = (feedingWithTransactions || []).map(record => {
        const feedTypeNormalized = record.feed_type.toLowerCase().trim();
        const hasMatchingInventory = inventoryFeedTypes.has(feedTypeNormalized);
        
        return {
          id: record.id,
          record_datetime: record.record_datetime,
          feed_type: record.feed_type,
          kilograms: record.kilograms,
          animal_name: record.animal.name || "Unknown",
          animal_ear_tag: record.animal.ear_tag || "",
          has_transaction: hasMatchingInventory
        };
      });

      setAuditData(auditResults);
    } catch (error) {
      console.error("Error loading audit data:", error);
      toast.error("Failed to load audit report");
    } finally {
      setLoading(false);
    }
  };

  const issueCount = auditData.filter(r => !r.has_transaction).length;
  const totalRecords = auditData.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Audit Report</CardTitle>
          <CardDescription>Loading audit data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Inventory Audit Report
          {issueCount > 0 ? (
            <Badge variant="destructive" className="ml-auto">
              {issueCount} Issues Found
            </Badge>
          ) : (
            <Badge variant="default" className="ml-auto bg-green-600">
              All Clear
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Feeding records analyzed: {totalRecords} | Records without inventory match: {issueCount}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No feeding records found for this farm.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Feed Type</TableHead>
                  <TableHead className="text-right">Quantity (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditData.map((record) => (
                  <TableRow key={record.id} className={!record.has_transaction ? "bg-destructive/5" : ""}>
                    <TableCell>
                      {record.has_transaction ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.record_datetime), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.animal_name}</div>
                        {record.animal_ear_tag && (
                          <div className="text-xs text-muted-foreground">{record.animal_ear_tag}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.feed_type}
                      {!record.has_transaction && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          No Match
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {record.kilograms.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

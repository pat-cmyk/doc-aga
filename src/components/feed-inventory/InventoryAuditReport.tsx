import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Leaf, Link2Off, DollarSign, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatPHP } from "@/lib/currency";

type AuditStatus = 'linked' | 'fresh_cut' | 'untracked' | 'missing_cost';

interface AuditRecord {
  id: string;
  record_datetime: string;
  feed_type: string;
  kilograms: number;
  animal_name: string;
  animal_ear_tag: string;
  feed_inventory_id: string | null;
  cost_per_kg_at_time: number | null;
  status: AuditStatus;
}

interface AuditSummary {
  totalRecords: number;
  linkedCount: number;
  freshCutCount: number;
  untrackedCount: number;
  missingCostCount: number;
  totalCostTracked: number;
  percentageLinked: number;
}

const STATUS_CONFIG: Record<AuditStatus, { icon: React.ReactNode; label: string; color: string }> = {
  linked: {
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    label: 'Linked',
    color: 'bg-green-50 dark:bg-green-950/30'
  },
  fresh_cut: {
    icon: <Leaf className="h-4 w-4 text-emerald-600" />,
    label: 'Fresh Cut',
    color: 'bg-emerald-50 dark:bg-emerald-950/30'
  },
  untracked: {
    icon: <Link2Off className="h-4 w-4 text-destructive" />,
    label: 'Untracked',
    color: 'bg-destructive/5'
  },
  missing_cost: {
    icon: <DollarSign className="h-4 w-4 text-amber-600" />,
    label: 'No Cost',
    color: 'bg-amber-50 dark:bg-amber-950/30'
  }
};

export function InventoryAuditReport({ farmId }: { farmId: string }) {
  const [auditData, setAuditData] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'issues'>('all');

  useEffect(() => {
    loadAuditData();
  }, [farmId]);

  const loadAuditData = async () => {
    try {
      setLoading(true);

      // Fetch feeding records with the new FK and cost columns
      const { data: feedingRecords, error: feedingError } = await supabase
        .from("feeding_records")
        .select(`
          id,
          record_datetime,
          feed_type,
          kilograms,
          feed_inventory_id,
          cost_per_kg_at_time,
          animal:animals!inner(
            name,
            ear_tag,
            farm_id
          )
        `)
        .eq("animal.farm_id", farmId)
        .order("record_datetime", { ascending: false })
        .limit(200);

      if (feedingError) throw feedingError;

      // Process records and determine status
      const auditResults: AuditRecord[] = (feedingRecords || []).map(record => {
        const isFreshCut = record.feed_type === 'Fresh Cut and Carry';
        const hasInventoryLink = !!record.feed_inventory_id;
        const hasCostLock = record.cost_per_kg_at_time !== null;

        let status: AuditStatus;
        if (isFreshCut) {
          status = 'fresh_cut';
        } else if (hasInventoryLink && hasCostLock) {
          status = 'linked';
        } else if (hasInventoryLink && !hasCostLock) {
          status = 'missing_cost';
        } else {
          status = 'untracked';
        }

        return {
          id: record.id,
          record_datetime: record.record_datetime,
          feed_type: record.feed_type,
          kilograms: record.kilograms,
          animal_name: record.animal.name || "Unknown",
          animal_ear_tag: record.animal.ear_tag || "",
          feed_inventory_id: record.feed_inventory_id,
          cost_per_kg_at_time: record.cost_per_kg_at_time,
          status,
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

  // Calculate summary
  const summary: AuditSummary = useMemo(() => {
    const linkedCount = auditData.filter(r => r.status === 'linked').length;
    const freshCutCount = auditData.filter(r => r.status === 'fresh_cut').length;
    const untrackedCount = auditData.filter(r => r.status === 'untracked').length;
    const missingCostCount = auditData.filter(r => r.status === 'missing_cost').length;
    
    const totalCostTracked = auditData.reduce((sum, r) => {
      if (r.cost_per_kg_at_time) {
        return sum + (r.kilograms * r.cost_per_kg_at_time);
      }
      return sum;
    }, 0);

    const totalRecords = auditData.length;
    const percentageLinked = totalRecords > 0 
      ? Math.round(((linkedCount + freshCutCount) / totalRecords) * 100) 
      : 0;

    return {
      totalRecords,
      linkedCount,
      freshCutCount,
      untrackedCount,
      missingCostCount,
      totalCostTracked,
      percentageLinked,
    };
  }, [auditData]);

  const filteredData = useMemo(() => {
    if (filter === 'issues') {
      return auditData.filter(r => r.status === 'untracked' || r.status === 'missing_cost');
    }
    return auditData;
  }, [auditData, filter]);

  const issueCount = summary.untrackedCount + summary.missingCostCount;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Audit Report</CardTitle>
          <CardDescription>Loading audit data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Total Records</div>
            <p className="text-2xl font-bold">{summary.totalRecords}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Properly Linked</div>
            <p className="text-2xl font-bold text-green-600">{summary.percentageLinked}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Cost Tracked</div>
            <p className="text-2xl font-bold">{formatPHP(summary.totalCostTracked)}</p>
          </CardContent>
        </Card>
        <Card className={issueCount > 0 ? 'border-destructive/50' : 'border-green-500/50'}>
          <CardContent className="pt-4">
            <div className="text-muted-foreground text-sm">Issues Found</div>
            <p className={`text-2xl font-bold ${issueCount > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {issueCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Audit Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                Feeding Records Audit
                {issueCount > 0 ? (
                  <Badge variant="destructive">{issueCount} Issues</Badge>
                ) : (
                  <Badge className="bg-green-600">All Clear</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Last 200 feeding records analyzed
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({summary.totalRecords})
              </Button>
              <Button
                variant={filter === 'issues' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('issues')}
                className={filter === 'issues' ? '' : issueCount > 0 ? 'border-destructive text-destructive' : ''}
              >
                <Filter className="h-4 w-4 mr-1" />
                Issues ({issueCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === 'issues' 
                ? "No issues found - all records are properly linked!"
                : "No feeding records found for this farm."
              }
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Animal</TableHead>
                    <TableHead>Feed Type</TableHead>
                    <TableHead className="text-right">Qty (kg)</TableHead>
                    <TableHead className="text-right">Cost/kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((record) => {
                    const config = STATUS_CONFIG[record.status];
                    return (
                      <TableRow key={record.id} className={config.color}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            <span className="text-xs hidden sm:inline">{config.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(record.record_datetime), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium truncate max-w-[120px]">{record.animal_name}</div>
                            {record.animal_ear_tag && (
                              <div className="text-xs text-muted-foreground">{record.animal_ear_tag}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="truncate max-w-[150px] block">{record.feed_type}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {record.kilograms.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.cost_per_kg_at_time !== null ? (
                            <span className="text-green-600 font-medium">
                              {formatPHP(record.cost_per_kg_at_time, true)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                {config.icon}
                <span>{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useAuditReport } from "@/hooks/useAuditReport";
import { exportAuditReportToPDF } from "@/lib/auditReportExport";
import { format, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Shield,
  FileText,
  Download,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import type { AuditReportData, AuditDailyEntry, AuditTerminalDigit } from "@/types/auditReport";

const AdminAuditReport = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();

  const [startDate, setStartDate] = useState(() =>
    format(subMonths(new Date(), 3), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [reportRequested, setReportRequested] = useState(false);

  const { data: farm, isLoading: farmLoading } = useQuery({
    queryKey: ["admin-audit-farm", farmId],
    queryFn: async () => {
      if (!farmId) throw new Error("No farm ID");
      const { data, error } = await supabase
        .from("farms")
        .select("*, profiles:owner_id (full_name)")
        .eq("id", farmId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!farmId && !adminLoading && !!isAdmin,
  });

  const {
    data: report,
    isLoading: reportLoading,
    error: reportError,
  } = useAuditReport(
    farmId,
    new Date(startDate),
    new Date(endDate),
    reportRequested && !!farmId
  );

  if (adminLoading || farmLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/admin");
    return null;
  }

  const handleGenerate = () => {
    setReportRequested(true);
  };

  const handleExportPDF = () => {
    if (!report) return;
    exportAuditReportToPDF(report);
  };

  const formatRole = (role: string) => {
    switch (role) {
      case "farmer_owner": return "Owner/Manager";
      case "farmhand": return "Farmhand";
      case "vet": return "Veterinarian";
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="font-medium">Data Integrity Audit</span>
              {farm && (
                <>
                  <span className="text-primary-foreground/80 hidden sm:inline">|</span>
                  <span className="hidden sm:inline">{farm.name}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <Button size="sm" variant="secondary" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/admin/view-farm/${farmId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Audit Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setReportRequested(false);
                  }}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setReportRequested(false);
                  }}
                />
              </div>
              <Button onClick={handleGenerate} disabled={reportLoading}>
                {reportLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>

        {reportError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                Failed to generate report: {(reportError as Error).message}
              </p>
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            {/* Section A: Farm Summary */}
            <SectionFarmSummary data={report.farm_summary} />

            {/* Section B: Daily Entry Log */}
            <SectionDailyEntryLog data={report.daily_entry_log} formatRole={formatRole} />

            {/* Section C: Temporal Integrity */}
            <SectionTemporalIntegrity data={report.temporal_integrity} formatRole={formatRole} />

            {/* Section D: Value Distribution */}
            <SectionValueDistribution data={report.value_distribution} />

            {/* Section E: Cross-Dataset Consistency */}
            <SectionCrossConsistency data={report.cross_dataset_consistency} />

            {/* Section F: User Attribution */}
            <SectionUserAttribution data={report.user_attribution} formatRole={formatRole} />

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center italic pb-8">
              This report presents factual data entry patterns. No assessment or recommendation is implied.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

/* =========================================
   SECTION COMPONENTS
   ========================================= */

function SectionFarmSummary({ data }: { data: AuditReportData["farm_summary"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Farm Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableBody>
              <TableRow><TableCell className="font-medium">Farm Name</TableCell><TableCell>{data.farm_name}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Owner</TableCell><TableCell>{data.owner_name}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Region</TableCell><TableCell>{data.region || "—"}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Audit Period</TableCell><TableCell>{data.period_start} to {data.period_end}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Active Animals</TableCell><TableCell>{data.total_active_animals}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Registered Users</TableCell><TableCell>{data.total_users}</TableCell></TableRow>
              <TableRow><TableCell className="font-medium">Report Generated</TableCell><TableCell>{new Date(data.generated_at).toLocaleString("en-PH")}</TableCell></TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionDailyEntryLog({
  data,
  formatRole,
}: {
  data: AuditDailyEntry[];
  formatRole: (r: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Daily Data Entry Log</CardTitle>
        <p className="text-sm text-muted-foreground">
          Records grouped by the date they were entered into the system and by user.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Milking</TableHead>
                <TableHead className="text-right">Feeding</TableHead>
                <TableHead className="text-right">Health</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Injection</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    No records found in this period.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{row.entry_date}</TableCell>
                    <TableCell>{row.user_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {formatRole(row.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.milking_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.feeding_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.health_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.weight_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.injection_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.expense_count || "—"}</TableCell>
                    <TableCell className="text-right">{row.revenue_count || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{row.total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTemporalIntegrity({
  data,
  formatRole: _formatRole,
}: {
  data: AuditReportData["temporal_integrity"];
  formatRole: (r: string) => string;
}) {
  const recordTypes = Object.keys(data.backdating_ratio).filter((k) => k !== "overall");

  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Temporal Integrity Metrics</CardTitle>
        <p className="text-sm text-muted-foreground">
          Analyzes when records were entered relative to their event dates and entry patterns.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backdating Ratio */}
        <div>
          <h4 className="font-medium mb-2">Backdating Ratio (% of records entered &gt;7 days after event)</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {recordTypes.map((t) => (
                    <TableHead key={t} className="text-center capitalize">{t}</TableHead>
                  ))}
                  <TableHead className="text-center font-bold">Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {recordTypes.map((t) => (
                    <TableCell key={t} className="text-center">{data.backdating_ratio[t]}%</TableCell>
                  ))}
                  <TableCell className="text-center font-bold">{data.backdating_ratio.overall}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Continuity Scores */}
        <div>
          <h4 className="font-medium mb-2">Record Continuity (% of days with at least 1 entry)</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(data.continuity_scores)
                    .filter((k) => k !== "overall")
                    .map((t) => (
                      <TableHead key={t} className="text-center capitalize">{t}</TableHead>
                    ))}
                  <TableHead className="text-center font-bold">Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {Object.keys(data.continuity_scores)
                    .filter((k) => k !== "overall")
                    .map((t) => (
                      <TableCell key={t} className="text-center">{data.continuity_scores[t]}%</TableCell>
                    ))}
                  <TableCell className="text-center font-bold">{data.continuity_scores.overall}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Entry Time Distribution */}
        <div>
          <h4 className="font-medium mb-2">Entry Time Distribution (by hour of day, PH time)</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.hourly_distribution.map((h) => (
                    <TableHead key={h.hour} className="text-center text-xs px-1">
                      {String(h.hour).padStart(2, "0")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {data.hourly_distribution.map((h) => (
                    <TableCell key={h.hour} className="text-center text-xs px-1">
                      {h.count}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="rounded-md border">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Max Records in 1 Hour (Single User)</TableCell>
                <TableCell>
                  {data.max_hourly_burst.count} records
                  {data.max_hourly_burst.user_name && ` by ${data.max_hourly_burst.user_name}`}
                  {data.max_hourly_burst.timestamp && ` at ${new Date(data.max_hourly_burst.timestamp).toLocaleString("en-PH")}`}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Avg. Time Between Consecutive Entries</TableCell>
                <TableCell>{data.avg_inter_record_interval_minutes} minutes</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionValueDistribution({ data }: { data: AuditReportData["value_distribution"] }) {
  const renderDigitTable = (label: string, digits: AuditTerminalDigit[]) => (
    <div>
      <h4 className="font-medium mb-2">{label} — Terminal Digit Distribution</h4>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Digit</TableHead>
              {digits.map((d) => (
                <TableHead key={d.digit} className="text-center">{d.digit}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Count</TableCell>
              {digits.map((d) => (
                <TableCell key={d.digit} className="text-center">{d.count ?? 0}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">%</TableCell>
              {digits.map((d) => (
                <TableCell key={d.digit} className="text-center">{d.pct ?? 0}%</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-muted-foreground">Expected</TableCell>
              {digits.map((d) => (
                <TableCell key={d.digit} className="text-center text-muted-foreground">10%</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>4. Value Distribution Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Checks whether recorded values follow natural distribution patterns.
          Genuine data shows roughly uniform terminal digits (~10% each).
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderDigitTable("Milk (liters)", data.terminal_digits.milk)}
        {renderDigitTable("Weight (kg)", data.terminal_digits.weight)}
        {renderDigitTable("Feed (kg)", data.terminal_digits.feed)}

        {/* Duplicate Ratios */}
        <div>
          <h4 className="font-medium mb-2">Duplicate Value Ratios</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead className="text-center">Duplicate %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell>Milk Liters</TableCell><TableCell className="text-center">{data.duplicate_ratios.milk_pct}%</TableCell></TableRow>
                <TableRow><TableCell>Weight (kg)</TableCell><TableCell className="text-center">{data.duplicate_ratios.weight_pct}%</TableCell></TableRow>
                <TableRow><TableCell>Feed (kg)</TableCell><TableCell className="text-center">{data.duplicate_ratios.feed_pct}%</TableCell></TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Per-Animal Milk Yield */}
        {data.milk_yield_stats.animals.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">
              Per-Animal Milk Yield Statistics
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Overall CV: {data.milk_yield_stats.overall_cv}%)
              </span>
            </h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ear Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Avg Liters</TableHead>
                    <TableHead className="text-right">Std Dev</TableHead>
                    <TableHead className="text-right">CV %</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.milk_yield_stats.animals.map((animal) => (
                    <TableRow key={animal.ear_tag}>
                      <TableCell>{animal.ear_tag}</TableCell>
                      <TableCell>{animal.name}</TableCell>
                      <TableCell className="text-right">{animal.avg_liters}</TableCell>
                      <TableCell className="text-right">{animal.std_dev}</TableCell>
                      <TableCell className="text-right">{animal.cv}%</TableCell>
                      <TableCell className="text-right">{animal.record_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionCrossConsistency({ data }: { data: AuditReportData["cross_dataset_consistency"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5. Cross-Dataset Consistency</CardTitle>
        <p className="text-sm text-muted-foreground">
          Checks whether financial records are substantiated by operational data.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Milk Revenue Entries Linked to Production Records</TableCell>
                <TableCell>{data.revenue_linkage_pct}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Expense Entries with Receipt Attachments</TableCell>
                <TableCell>{data.receipt_attachment_pct}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {data.feed_milk_trend.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Monthly Feed vs. Milk Production Trend</h4>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Feed Consumed (kg)</TableHead>
                    <TableHead className="text-right">Milk Produced (liters)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.feed_milk_trend.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{row.month}</TableCell>
                      <TableCell className="text-right">{Number(row.total_feed_kg).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(row.total_milk_liters).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionUserAttribution({
  data,
  formatRole,
}: {
  data: AuditReportData["user_attribution"];
  formatRole: (r: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>6. User Attribution Summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shows who entered data, how many records, and over what period.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Active Days</TableHead>
                <TableHead>First Entry</TableHead>
                <TableHead>Last Entry</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((user, i) => (
                <TableRow key={i}>
                  <TableCell>{user.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {formatRole(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{user.total_records}</TableCell>
                  <TableCell className="text-right">{user.active_days}</TableCell>
                  <TableCell>{user.first_entry}</TableCell>
                  <TableCell>{user.last_entry}</TableCell>
                  <TableCell className="text-right">{user.pct_of_total}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminAuditReport;

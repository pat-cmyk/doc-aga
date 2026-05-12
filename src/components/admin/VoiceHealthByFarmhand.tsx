/**
 * VoiceHealthByFarmhand — per-farmhand voice usage / abandonment table.
 * Lives in AdminViewFarm > Voice Health tab. Answers "which farmer is having
 * the worst time with voice input, and is it pushing them back to manual entry?"
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useVoiceHealthByFarm } from "@/hooks/useVoiceHealthByFarm";
import { Mic, MicOff, AlertOctagon } from "lucide-react";

interface VoiceHealthByFarmhandProps {
  farmId: string;
}

export function VoiceHealthByFarmhand({ farmId }: VoiceHealthByFarmhandProps) {
  const [daysBack, setDaysBack] = useState<7 | 30 | 90>(30);
  const { data, isLoading, error } = useVoiceHealthByFarm(farmId, daysBack);

  const rows = data?.rows ?? [];

  // Aggregate top-line numbers for the header cards.
  const totalAttempts = rows.reduce((s, r) => s + r.attempts_total, 0);
  const totalAbandoned = rows.reduce((s, r) => s + r.cancelled_count + r.timeout_count, 0);
  const totalRetyped = rows.reduce((s, r) => s + r.abandoned_then_manual_count, 0);
  const farmAbandonmentPct = totalAttempts > 0 ? Math.round((totalAbandoned / totalAttempts) * 1000) / 10 : 0;
  const farmRetryPct = totalAbandoned > 0 ? Math.round((totalRetyped / totalAbandoned) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        {([7, 30, 90] as const).map((n) => (
          <Button
            key={n}
            size="sm"
            variant={daysBack === n ? "default" : "outline"}
            onClick={() => setDaysBack(n)}
          >
            {n} Days
          </Button>
        ))}
      </div>

      {/* Top-line cards for this farm */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />Voice Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAttempts}</div>
            <p className="text-xs text-muted-foreground">across {rows.length} farmhand{rows.length === 1 ? "" : "s"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MicOff className="h-4 w-4 text-amber-500" />Farm Abandonment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{farmAbandonmentPct}%</div>
            <p className="text-xs text-muted-foreground">{totalAbandoned} cancelled / timed out</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600" />Voice → Manual Retry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{farmRetryPct}%</div>
            <p className="text-xs text-muted-foreground">
              {totalRetyped} retyped manually within 5 min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-farmhand table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Farmhand Voice Health</CardTitle>
          <CardDescription>
            Voice usage by user for the selected window. Sorted by attempt volume.
            High <strong>Abandoned %</strong> means voice is failing them at the
            confirmation step; high <strong>Retry %</strong> means it pushed them
            back to manual entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground">
              Failed to load voice health.
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No voice attempts recorded for this farm in the selected window.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmhand</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Cancelled</TableHead>
                  <TableHead className="text-right">Timeout</TableHead>
                  <TableHead className="text-right">Abandoned %</TableHead>
                  <TableHead className="text-right">Retry %</TableHead>
                  <TableHead className="text-right">Avg latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <div className="font-medium">{r.display_name}</div>
                      {r.email && (
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{r.attempts_total}</TableCell>
                    <TableCell className="text-right text-green-700">{r.committed_count}</TableCell>
                    <TableCell className="text-right text-amber-700">{r.cancelled_count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.timeout_count}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          r.abandonment_pct >= 30 ? "destructive" :
                          r.abandonment_pct >= 15 ? "secondary" : "outline"
                        }
                      >
                        {r.abandonment_pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={r.abandoned_then_manual_pct >= 50 ? "destructive" : "outline"}
                      >
                        {r.abandoned_then_manual_pct}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.avg_latency_ms ? `${r.avg_latency_ms} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

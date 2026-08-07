import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bug, RefreshCw, Users, Ticket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useErrorLogs, ErrorLogSeverity } from "@/hooks/useErrorLogs";
import { ErrorDetailPanel } from "./ErrorDetailPanel";
import { describeError } from "@/lib/errorHandling";

export function severityBadgeVariant(
  severity: ErrorLogSeverity,
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "crash":
      return "destructive";
    case "server":
      return "default";
    case "toast":
      return "secondary";
    case "silent":
      return "outline";
  }
}

type StatusFilter = "active" | "all" | "new" | "investigating" | "resolved" | "ignored";

export const ErrorMonitoringTab = () => {
  const { groups, counts, isLoading, error, refetch } = useErrorLogs();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | ErrorLogSeverity>("all");
  // Store only the id, not the whole group object — deriving `selected` from the
  // live `groups` array each render avoids showing a stale status/ticket after a
  // mutation or the 60s refetch updates the underlying data.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups.find((g) => g.id === selectedId) ?? null;

  if (error) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Bug className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{describeError(error).description}</p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const filtered = groups.filter((g) => {
    const statusOk =
      statusFilter === "all" ? true
      : statusFilter === "active" ? g.status === "new" || g.status === "investigating"
      : g.status === statusFilter;
    const severityOk = severityFilter === "all" || g.severity === severityFilter;
    return statusOk && severityOk;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <Bug className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Error Monitoring</h2>
          {counts && (
            <Badge variant={counts.new > 0 ? "destructive" : "secondary"}>
              {counts.new} new
            </Badge>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (new + investigating)</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as "all" | ErrorLogSeverity)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="crash">Crash</SelectItem>
            <SelectItem value="server">Server</SelectItem>
            <SelectItem value="toast">Toast</SelectItem>
            <SelectItem value="silent">Silent</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No errors match the current filters. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <Card
              key={g.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedId(g.id)}
            >
              <CardContent className="py-3 flex items-center gap-3">
                <Badge variant={severityBadgeVariant(g.severity)}>{g.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {g.translated_title || g.message}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {g.message} · last seen{" "}
                    {formatDistanceToNow(new Date(g.last_seen_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                  {g.linked_ticket_number && (
                    <Badge variant="secondary" className="gap-1">
                      <Ticket className="h-3 w-3" />
                      {g.linked_ticket_number}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {g.affected_user_count}
                  </span>
                  <Badge variant="outline">×{g.occurrence_count}</Badge>
                  <Badge variant={g.status === "new" ? "destructive" : "outline"}>{g.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ErrorDetailPanel errorLog={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
};

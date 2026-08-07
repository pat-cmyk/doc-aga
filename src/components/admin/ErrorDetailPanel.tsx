import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ticket } from "lucide-react";
import { formatPHDateAndTime } from "@/lib/dateUtils";
import { ErrorLogGroup, ErrorLogStatus, useErrorLogs } from "@/hooks/useErrorLogs";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { severityBadgeVariant } from "./ErrorMonitoringTab";

interface ErrorDetailPanelProps {
  errorLog: ErrorLogGroup | null;
  onClose: () => void;
}

export const ErrorDetailPanel = ({ errorLog, onClose }: ErrorDetailPanelProps) => {
  const { updateStatus, linkTicket } = useErrorLogs();
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  if (!errorLog) return null;

  const contextRoute = typeof errorLog.context?.route === "string" ? errorLog.context.route : "—";
  const contextDevice = typeof errorLog.context?.user_agent === "string" ? errorLog.context.user_agent : "—";

  return (
    <Sheet open={!!errorLog} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant={severityBadgeVariant(errorLog.severity)}>{errorLog.severity}</Badge>
            <Badge variant="outline">×{errorLog.occurrence_count}</Badge>
          </div>
          <SheetTitle className="text-left break-words">
            {errorLog.translated_title || errorLog.message.slice(0, 80)}
          </SheetTitle>
          <SheetDescription className="text-left">
            First seen {formatPHDateAndTime(errorLog.first_seen_at)} · Last seen{" "}
            {formatPHDateAndTime(errorLog.last_seen_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-1">
            <Label>Raw message</Label>
            <pre className="p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">
              {errorLog.message}
            </pre>
          </div>

          {errorLog.stack && (
            <div className="space-y-1">
              <Label>Stack trace</Label>
              <pre className="p-2 bg-muted rounded text-xs overflow-auto max-h-48 max-w-full">
                {errorLog.stack}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label>Route</Label>
              <p className="text-muted-foreground break-words">{contextRoute}</p>
            </div>
            <div>
              <Label>Farm</Label>
              <p className="text-muted-foreground">{errorLog.farm_name || "—"}</p>
            </div>
            <div>
              <Label>Affected users</Label>
              <p className="text-muted-foreground">{errorLog.affected_user_count}</p>
            </div>
            <div>
              <Label>Device</Label>
              <p className="text-muted-foreground text-xs break-words">{contextDevice}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={errorLog.status}
              onValueChange={(v) =>
                updateStatus.mutate({ id: errorLog.id, status: v as ErrorLogStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {errorLog.linked_ticket_number ? (
            <div className="flex items-center gap-2 text-sm">
              <Ticket className="h-4 w-4" />
              Linked ticket: <Badge variant="secondary">{errorLog.linked_ticket_number}</Badge>
            </div>
          ) : (
            <Button onClick={() => setTicketDialogOpen(true)}>
              <Ticket className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          )}
        </div>

        <CreateTicketDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          linkedFarmId={errorLog.farm_id ?? undefined}
          linkedUserId={errorLog.user_id ?? undefined}
          initialSubject={errorLog.translated_title || `App error: ${errorLog.message.slice(0, 60)}`}
          initialDescription={`Created from Error Monitoring.\n\nError: ${errorLog.message}\nSeverity: ${errorLog.severity}\nRoute: ${contextRoute}\nOccurrences: ${errorLog.occurrence_count}\nAffected users: ${errorLog.affected_user_count}\nFirst seen: ${errorLog.first_seen_at}`}
          initialPriority={errorLog.severity === "crash" ? "high" : "medium"}
          initialTags={["auto-error"]}
          onCreated={(ticketId) => linkTicket.mutate({ id: errorLog.id, ticketId })}
        />
      </SheetContent>
    </Sheet>
  );
};

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ticket, Clipboard, ClipboardCheck, ClipboardX } from "lucide-react";
import { formatPHDateAndTime } from "@/lib/dateUtils";
import { buildClaudeDebugPrompt } from "@/lib/errorPrompt";
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
  // FIX10: createTicket can succeed while the follow-up set_error_log_ticket
  // link fails (network blip between the two calls) — without tracking the
  // created ticket id separately, the panel falls back to showing "Create
  // Ticket" again, and a retry there creates a SECOND ticket for the same
  // error. This lets the panel offer "Retry link" instead.
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // Reset when the panel is pointed at a different error (or closed) so a
  // stale pending-link state from one error can't bleed into another.
  useEffect(() => {
    setPendingTicketId(null);
    setCopyState("idle");
  }, [errorLog?.id]);

  if (!errorLog) return null;

  const retryLink = () => {
    if (!pendingTicketId) return;
    linkTicket.mutate(
      { id: errorLog.id, ticketId: pendingTicketId },
      { onSuccess: () => setPendingTicketId(null) },
    );
  };

  const contextRoute = typeof errorLog.context?.route === "string" ? errorLog.context.route : "—";
  const contextDevice = typeof errorLog.context?.user_agent === "string" ? errorLog.context.user_agent : "—";

  const copyForClaude = async () => {
    try {
      await navigator.clipboard.writeText(buildClaudeDebugPrompt(errorLog));
      setCopyState("copied");
    } catch (copyError) {
      console.error("[ErrorDetailPanel] clipboard write failed:", copyError);
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={copyForClaude}
            className="w-full sm:w-auto"
          >
            {copyState === "copied" ? (
              <>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Copied — paste into Claude
              </>
            ) : copyState === "failed" ? (
              <>
                <ClipboardX className="h-4 w-4 mr-2" />
                Copy failed — try again
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4 mr-2" />
                Copy for Claude
              </>
            )}
          </Button>

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
          ) : pendingTicketId ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Ticket created — linking…</span>
              <Button variant="outline" size="sm" onClick={retryLink} disabled={linkTicket.isPending}>
                Retry link
              </Button>
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
          onCreated={(ticketId) => {
            // FIX10: remember the ticket id BEFORE attempting the link, so a
            // failed link (default error toast still fires via linkTicket's
            // own onError) leaves "Retry link" available instead of a
            // "Create Ticket" button that would mint a duplicate ticket.
            setPendingTicketId(ticketId);
            linkTicket.mutate(
              { id: errorLog.id, ticketId },
              { onSuccess: () => setPendingTicketId(null) },
            );
          }}
        />
      </SheetContent>
    </Sheet>
  );
};

/**
 * Builds a ready-to-paste debugging prompt from an error-log group, for the
 * "Copy for Claude" button in the admin Error Monitoring detail panel.
 * Pure function — no side effects.
 */
import type { ErrorLogGroup } from "@/hooks/useErrorLogs";

export function buildClaudeDebugPrompt(errorLog: ErrorLogGroup): string {
  const route = typeof errorLog.context?.route === "string" ? errorLog.context.route : "unknown";
  const device =
    typeof errorLog.context?.user_agent === "string" ? errorLog.context.user_agent : "unknown";

  const lines: string[] = [
    "Fix this production error from Doc Aga error monitoring:",
    "",
    `Severity: ${errorLog.severity}`,
    `Route: ${route}`,
    `Occurrences: ${errorLog.occurrence_count}, affected users: ${errorLog.affected_user_count}`,
    `First seen: ${errorLog.first_seen_at} · Last seen: ${errorLog.last_seen_at}`,
  ];

  if (errorLog.farm_name) lines.push(`Farm: ${errorLog.farm_name}`);
  if (errorLog.linked_ticket_number) lines.push(`Ticket: ${errorLog.linked_ticket_number}`);
  if (errorLog.translated_title) lines.push(`Shown to user as: ${errorLog.translated_title}`);
  lines.push(`Device: ${device}`);

  lines.push("", "Raw message:", errorLog.message);

  if (errorLog.stack) {
    lines.push("", "Stack trace:", errorLog.stack);
  }

  lines.push(
    "",
    "Find the root cause, fix it following the CLAUDE.md rules (offline-first, SSOT, reuse), and add a regression test.",
  );

  return lines.join("\n");
}

/**
 * Shared server-side error logger for Edge Functions.
 * Writes severity 'server' rows to client_error_logs via the service role
 * (bypasses RLS — the table has no INSERT policy by design).
 * Fire-and-forget: never throws, never breaks the calling function.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export async function logServerError(
  fnName: string,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;
    const admin = createClient(url, key);

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;
    const normalized = message
      .toLowerCase()
      .replace(UUID_RE, '<id>')
      .replace(/\d+/g, '#')
      .slice(0, 80);
    const fingerprint = `server|${fnName}|${normalized}`.slice(0, 128);
    const nowIso = new Date().toISOString();

    const { data: existing } = await admin
      .from('client_error_logs')
      .select('id, occurrence_count, status')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existing) {
      await admin
        .from('client_error_logs')
        .update({
          message: message.slice(0, 2000),
          stack,
          context: { function: fnName, ...context },
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: nowIso,
          updated_at: nowIso,
          status: existing.status === 'resolved' ? 'new' : existing.status,
        })
        .eq('id', existing.id);
    } else {
      await admin.from('client_error_logs').insert({
        fingerprint,
        severity: 'server',
        message: message.slice(0, 2000),
        stack,
        context: { function: fnName, ...context },
      });
    }
  } catch (logErr) {
    console.error('[errorLogger] failed to log server error:', logErr);
  }
}

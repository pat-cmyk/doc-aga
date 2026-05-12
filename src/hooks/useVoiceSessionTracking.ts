/**
 * useVoiceSessionTracking — SSOT for voice attempt lifecycle telemetry.
 *
 * Records every voice attempt into `voice_session_attempts` so we can measure
 * abandonment (farmer speaks → sees wrong parsed data → cancels → re-types manually).
 *
 * Lifecycle:
 *   start()    → INSERT a row, returns sessionId
 *   preview()  → UPDATE preview_shown_at + transcript_preview + parsed_fields
 *   cancel()   → UPDATE outcome='cancelled' (and stash session in sessionStorage so
 *                the next manual entry of the same record_type can mark it as
 *                followed_by_manual_within_5m)
 *   commit()   → UPDATE outcome='committed' + final_record_id
 *
 * Also exposes `consumeRecentlyCancelled(recordType)` — called by manual-entry
 * commit paths to detect "I just typed because voice failed" and mark the
 * abandoned attempt accordingly.
 *
 * Auth note: voice_session_attempts RLS lets users INSERT/UPDATE their own rows,
 * so we use the regular `supabase` client (no service role).
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceRecordType =
  | "milking"
  | "feeding"
  | "weight"
  | "health"
  | "injection"
  | "animal_registration";

export type VoiceCancelReason = "user_cancelled" | "timeout" | "permission_denied" | "error";

const CANCEL_FOLLOWUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_STORAGE_PREFIX = "lastCancelledVoiceAttempt:";

interface StashedCancelled {
  id: string;
  cancelledAt: number; // epoch ms
}

function stashCancelled(recordType: VoiceRecordType, id: string) {
  try {
    const payload: StashedCancelled = { id, cancelledAt: Date.now() };
    sessionStorage.setItem(SESSION_STORAGE_PREFIX + recordType, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable (private mode / Capacitor edge cases) — silently ignore.
  }
}

function readCancelled(recordType: VoiceRecordType): StashedCancelled | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_PREFIX + recordType);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StashedCancelled;
    if (Date.now() - parsed.cancelledAt > CANCEL_FOLLOWUP_WINDOW_MS) {
      sessionStorage.removeItem(SESSION_STORAGE_PREFIX + recordType);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearCancelled(recordType: VoiceRecordType) {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_PREFIX + recordType);
  } catch {
    // ignore
  }
}

export interface StartSessionParams {
  recordType: VoiceRecordType;
  farmId?: string | null;
  modelProvider?: "elevenlabs" | "gemini" | null;
}

export interface PreviewSessionParams {
  transcriptPreview: string;
  parsedFields?: Record<string, unknown> | null;
  modelProvider?: "elevenlabs" | "gemini" | null;
  modelVersion?: string | null;
}

export interface CommitSessionParams {
  finalRecordId: string;
  finalRecordTable: "milking_records" | "feeding_records" | "weight_records" | "health_records" | "injection_records" | "animals";
}

export interface UseVoiceSessionTrackingReturn {
  /** Insert a new voice_session_attempts row; returns sessionId (uuid) or null on failure. */
  start: (params: StartSessionParams) => Promise<string | null>;
  /** Mark preview shown + store transcript/parsed fields. */
  preview: (sessionId: string, params: PreviewSessionParams) => Promise<void>;
  /** Mark cancelled + reason; stash in sessionStorage for follow-up correlation. */
  cancel: (sessionId: string, recordType: VoiceRecordType, reason: VoiceCancelReason, transcriptPreview?: string) => Promise<void>;
  /** Mark committed + link to the new record. */
  commit: (sessionId: string, params: CommitSessionParams) => Promise<void>;
  /** Mark error outcome (e.g. transcription failure). */
  markError: (sessionId: string, errorMessage: string) => Promise<void>;
  /** Mark timeout outcome (preview shown but never confirmed nor explicitly cancelled). */
  markTimeout: (sessionId: string) => Promise<void>;
  /**
   * Manual-entry hook: if a same-type voice attempt was cancelled in the last 5 min,
   * mark that attempt as followed_by_manual_within_5m=true and clear the stash.
   * Returns true if a follow-up was recorded.
   */
  consumeRecentlyCancelled: (recordType: VoiceRecordType, manualRecordId?: string | null) => Promise<boolean>;
  /** The most recent session id created by this hook instance (debug helper). */
  currentSessionIdRef: React.MutableRefObject<string | null>;
}

export function useVoiceSessionTracking(): UseVoiceSessionTrackingReturn {
  const currentSessionIdRef = useRef<string | null>(null);

  const start = useCallback(async ({ recordType, farmId, modelProvider }: StartSessionParams) => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      console.warn("[useVoiceSessionTracking] No authenticated user; skipping start()");
      return null;
    }

    const { data, error } = await supabase
      // @ts-expect-error — voice_session_attempts not yet in generated types; safe narrow insert
      .from("voice_session_attempts")
      .insert({
        user_id: userData.user.id,
        farm_id: farmId ?? null,
        record_type: recordType,
        model_provider: modelProvider ?? null,
        outcome: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[useVoiceSessionTracking] start() failed:", error.message);
      return null;
    }

    const sessionId = (data as { id: string }).id;
    currentSessionIdRef.current = sessionId;
    return sessionId;
  }, []);

  const preview = useCallback(
    async (sessionId: string, { transcriptPreview, parsedFields, modelProvider, modelVersion }: PreviewSessionParams) => {
      const { error } = await supabase
        // @ts-expect-error — voice_session_attempts not yet in generated types
        .from("voice_session_attempts")
        .update({
          preview_shown_at: new Date().toISOString(),
          transcript_preview: transcriptPreview,
          parsed_fields: parsedFields ?? null,
          model_provider: modelProvider ?? undefined,
          model_version: modelVersion ?? undefined,
        })
        .eq("id", sessionId);

      if (error) console.warn("[useVoiceSessionTracking] preview() failed:", error.message);
    },
    [],
  );

  const cancel = useCallback(
    async (sessionId: string, recordType: VoiceRecordType, reason: VoiceCancelReason, transcriptPreview?: string) => {
      // Stash first so even if the network update fails we can still correlate locally.
      stashCancelled(recordType, sessionId);

      const { error } = await supabase
        // @ts-expect-error — voice_session_attempts not yet in generated types
        .from("voice_session_attempts")
        .update({
          outcome: "cancelled",
          cancel_reason: reason,
          ended_at: new Date().toISOString(),
          ...(transcriptPreview ? { transcript_preview: transcriptPreview } : {}),
        })
        .eq("id", sessionId);

      if (error) console.warn("[useVoiceSessionTracking] cancel() failed:", error.message);
    },
    [],
  );

  const commit = useCallback(
    async (sessionId: string, { finalRecordId, finalRecordTable }: CommitSessionParams) => {
      const { error } = await supabase
        // @ts-expect-error — voice_session_attempts not yet in generated types
        .from("voice_session_attempts")
        .update({
          outcome: "committed",
          ended_at: new Date().toISOString(),
          final_record_id: finalRecordId,
          final_record_table: finalRecordTable,
        })
        .eq("id", sessionId);

      if (error) console.warn("[useVoiceSessionTracking] commit() failed:", error.message);
    },
    [],
  );

  const markError = useCallback(async (sessionId: string, errorMessage: string) => {
    const { error } = await supabase
      // @ts-expect-error — voice_session_attempts not yet in generated types
      .from("voice_session_attempts")
      .update({
        outcome: "error",
        ended_at: new Date().toISOString(),
        cancel_reason: errorMessage.slice(0, 200),
      })
      .eq("id", sessionId);

    if (error) console.warn("[useVoiceSessionTracking] markError() failed:", error.message);
  }, []);

  const markTimeout = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      // @ts-expect-error — voice_session_attempts not yet in generated types
      .from("voice_session_attempts")
      .update({
        outcome: "timeout",
        ended_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) console.warn("[useVoiceSessionTracking] markTimeout() failed:", error.message);
  }, []);

  const consumeRecentlyCancelled = useCallback(
    async (recordType: VoiceRecordType, manualRecordId?: string | null) => {
      const stashed = readCancelled(recordType);
      if (!stashed) return false;

      const { error } = await supabase
        // @ts-expect-error — voice_session_attempts not yet in generated types
        .from("voice_session_attempts")
        .update({
          followed_by_manual_within_5m: true,
          followed_by_manual_record_id: manualRecordId ?? null,
        })
        .eq("id", stashed.id);

      if (error) {
        console.warn("[useVoiceSessionTracking] consumeRecentlyCancelled() failed:", error.message);
        return false;
      }

      clearCancelled(recordType);
      return true;
    },
    [],
  );

  return {
    start,
    preview,
    cancel,
    commit,
    markError,
    markTimeout,
    consumeRecentlyCancelled,
    currentSessionIdRef,
  };
}

-- Voice Session Attempts: track every voice-input attempt's full lifecycle
-- (started → preview → committed / cancelled / timeout / error) so we can measure
-- abandonment (farmer speaks, sees wrong parsed data, cancels and re-types manually).
--
-- Companion to stt_analytics (which only logs that a transcription happened) —
-- this links the attempt back to the eventual committed record (or its absence).

BEGIN;

CREATE TABLE public.voice_session_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK (record_type IN (
    'milking','feeding','weight','health','injection','animal_registration'
  )),

  -- Provider info (mirrors stt_analytics for joins/correlation)
  model_provider text,
  model_version text,

  -- Forensics — what the system heard / parsed vs. what user did
  transcript_preview text,
  parsed_fields jsonb,

  -- Lifecycle timestamps
  started_at timestamptz NOT NULL DEFAULT now(),
  preview_shown_at timestamptz,
  ended_at timestamptz,

  -- Final outcome
  outcome text CHECK (outcome IN ('committed','cancelled','timeout','error','pending')),
  cancel_reason text,                     -- 'user_cancelled' | 'timeout' | 'permission_denied' | null
  final_record_id uuid,                   -- nullable; the *_records row that was created when outcome='committed'
  final_record_table text,                -- which table final_record_id refers to (milking_records, etc.)

  -- Cross-flow signal: did a manual entry of the same record_type appear within 5 min after cancel?
  followed_by_manual_within_5m boolean NOT NULL DEFAULT false,
  followed_by_manual_record_id uuid,      -- pointer to the manual record that "replaced" this voice attempt

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the analytics queries
CREATE INDEX idx_vsa_user_id          ON public.voice_session_attempts(user_id);
CREATE INDEX idx_vsa_farm_id          ON public.voice_session_attempts(farm_id);
CREATE INDEX idx_vsa_started_at       ON public.voice_session_attempts(started_at);
CREATE INDEX idx_vsa_outcome          ON public.voice_session_attempts(outcome);
CREATE INDEX idx_vsa_record_type      ON public.voice_session_attempts(record_type);
CREATE INDEX idx_vsa_user_started     ON public.voice_session_attempts(user_id, started_at DESC);
CREATE INDEX idx_vsa_followed_manual  ON public.voice_session_attempts(followed_by_manual_within_5m)
  WHERE followed_by_manual_within_5m = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_voice_session_attempts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_vsa_set_updated_at
  BEFORE UPDATE ON public.voice_session_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_voice_session_attempts_updated_at();

-- RLS
ALTER TABLE public.voice_session_attempts ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own attempts (the recording happens client-side)
CREATE POLICY "Users insert own voice attempts"
  ON public.voice_session_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own attempts (to set outcome/cancel/commit linkage)
CREATE POLICY "Users update own voice attempts"
  ON public.voice_session_attempts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can SELECT their own attempts (for self-debug)
CREATE POLICY "Users view own voice attempts"
  ON public.voice_session_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Super admins can view ALL attempts (admin dashboard)
CREATE POLICY "Super admins view all voice attempts"
  ON public.voice_session_attempts
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

COMMIT;

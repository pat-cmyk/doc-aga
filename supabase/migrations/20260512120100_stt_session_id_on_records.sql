-- Add stt_session_id linkage column to record tables so voice-committed entries
-- point back to the voice_session_attempts row. Typed entries leave it NULL.
--
-- Combined with voice_session_attempts.final_record_id (the reverse direction),
-- this lets us cleanly join "voice attempt" ↔ "committed record" for analytics.

BEGIN;

ALTER TABLE public.milking_records   ADD COLUMN IF NOT EXISTS stt_session_id uuid REFERENCES public.voice_session_attempts(id);
ALTER TABLE public.feeding_records   ADD COLUMN IF NOT EXISTS stt_session_id uuid REFERENCES public.voice_session_attempts(id);
ALTER TABLE public.weight_records    ADD COLUMN IF NOT EXISTS stt_session_id uuid REFERENCES public.voice_session_attempts(id);
ALTER TABLE public.health_records    ADD COLUMN IF NOT EXISTS stt_session_id uuid REFERENCES public.voice_session_attempts(id);
ALTER TABLE public.injection_records ADD COLUMN IF NOT EXISTS stt_session_id uuid REFERENCES public.voice_session_attempts(id);

-- Indexes (sparse — only voice-entered rows have a value)
CREATE INDEX IF NOT EXISTS idx_milking_records_stt_session   ON public.milking_records(stt_session_id)   WHERE stt_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feeding_records_stt_session   ON public.feeding_records(stt_session_id)   WHERE stt_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weight_records_stt_session    ON public.weight_records(stt_session_id)    WHERE stt_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_records_stt_session    ON public.health_records(stt_session_id)    WHERE stt_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_injection_records_stt_session ON public.injection_records(stt_session_id) WHERE stt_session_id IS NOT NULL;

COMMIT;

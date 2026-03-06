-- Fix: Add 'taglish' to voice_training_samples language CHECK constraint
-- The code has always stored 'taglish' but the constraint only allowed english/tagalog
-- This was a live bug causing INSERT failures for all Taglish training samples
ALTER TABLE voice_training_samples DROP CONSTRAINT IF EXISTS voice_training_samples_language_check;
ALTER TABLE voice_training_samples ADD CONSTRAINT voice_training_samples_language_check
  CHECK (language IN ('english', 'tagalog', 'taglish'));

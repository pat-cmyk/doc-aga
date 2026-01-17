-- Phase 4: Backfill current_weight_kg from existing weight data

-- Backfill from entry_weight_kg for acquired animals
UPDATE animals 
SET current_weight_kg = entry_weight_kg,
    updated_at = now()
WHERE current_weight_kg IS NULL 
  AND entry_weight_kg IS NOT NULL 
  AND exit_date IS NULL 
  AND is_deleted = false;

-- Backfill from birth_weight_kg for farm-born animals (only if no entry_weight)
UPDATE animals 
SET current_weight_kg = birth_weight_kg,
    updated_at = now()
WHERE current_weight_kg IS NULL 
  AND birth_weight_kg IS NOT NULL 
  AND entry_weight_kg IS NULL
  AND exit_date IS NULL 
  AND is_deleted = false;
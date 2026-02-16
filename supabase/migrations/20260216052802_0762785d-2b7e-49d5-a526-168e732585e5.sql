-- Phase 1: Add input_method column to core record tables
ALTER TABLE feeding_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE milking_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE weight_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE health_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE injection_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE pending_activities ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
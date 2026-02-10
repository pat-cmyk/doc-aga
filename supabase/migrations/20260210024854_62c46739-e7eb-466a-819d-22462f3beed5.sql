CREATE UNIQUE INDEX idx_farm_revenues_unique_milk_log 
ON farm_revenues (linked_milk_log_id) 
WHERE linked_milk_log_id IS NOT NULL AND is_deleted = false;
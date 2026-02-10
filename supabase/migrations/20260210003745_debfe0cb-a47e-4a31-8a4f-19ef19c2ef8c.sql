
-- ============================================================
-- RLS DRIFT REMEDIATION — ALL 4 PHASES
-- ============================================================

-- ========================
-- PHASE 1: Security Gaps
-- ========================

-- 1A: Replace milk_inventory ALL policy with granular policies
DROP POLICY IF EXISTS "Users can access their farm's inventory" ON milk_inventory;

CREATE POLICY "inventory_select" ON milk_inventory
  FOR SELECT USING (can_access_farm(farm_id));

CREATE POLICY "inventory_insert" ON milk_inventory
  FOR INSERT WITH CHECK (
    is_farm_owner(auth.uid(), farm_id)
    OR is_farm_manager(auth.uid(), farm_id)
    OR is_farmhand(auth.uid(), farm_id)
  );

CREATE POLICY "inventory_update" ON milk_inventory
  FOR UPDATE USING (
    is_farm_owner(auth.uid(), farm_id)
    OR is_farm_manager(auth.uid(), farm_id)
  );

CREATE POLICY "inventory_delete" ON milk_inventory
  FOR DELETE USING (
    is_farm_owner(auth.uid(), farm_id)
  );

-- 1B: Add UPDATE policies for health tables (including vet)
CREATE POLICY "health_update" ON health_records
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = health_records.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));

CREATE POLICY "injection_update" ON injection_records
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = injection_records.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));

-- preventive_health_schedules: drop existing UPDATE, recreate with vet
DROP POLICY IF EXISTS "Farm owners and managers can update schedules" ON preventive_health_schedules;
CREATE POLICY "schedules_update" ON preventive_health_schedules
  FOR UPDATE USING (
    is_farm_owner(auth.uid(), farm_id)
    OR is_farm_manager(auth.uid(), farm_id)
    OR is_vet(auth.uid(), farm_id)
  );

-- 1C: Add vet INSERT on health_symptom_categories
DROP POLICY IF EXISTS "Farm members can insert symptom categories" ON health_symptom_categories;
CREATE POLICY "symptom_categories_insert" ON health_symptom_categories
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM health_records hr
    JOIN animals a ON a.id = hr.animal_id
    WHERE hr.id = health_symptom_categories.health_record_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));

-- 1D: Add government SELECT on injection_records
CREATE POLICY "government_view_injection_records" ON injection_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- ========================
-- PHASE 2: Missing DELETE/UPDATE Policies
-- ========================

-- 2A: DELETE policies
CREATE POLICY "campaigns_delete" ON ad_campaigns
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM merchants
    WHERE merchants.id = ad_campaigns.merchant_id
      AND merchants.user_id = auth.uid()
  ));

CREATE POLICY "ai_records_delete" ON ai_records
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = ai_records.animal_id
      AND is_farm_owner(auth.uid(), a.farm_id)
  ));

CREATE POLICY "events_delete" ON animal_events
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = animal_events.animal_id
      AND is_farm_owner(auth.uid(), a.farm_id)
  ));

CREATE POLICY "photos_delete" ON animal_photos
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = animal_photos.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id))
  ));

CREATE POLICY "checklists_delete" ON daily_farm_checklists
  FOR DELETE USING (
    is_farm_owner(auth.uid(), farm_id)
  );

CREATE POLICY "health_delete" ON health_records
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = health_records.animal_id
      AND is_farm_owner(auth.uid(), a.farm_id)
  ));

CREATE POLICY "injection_delete" ON injection_records
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = injection_records.animal_id
      AND is_farm_owner(auth.uid(), a.farm_id)
  ));

-- 2B: UPDATE policies
CREATE POLICY "events_update" ON animal_events
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = animal_events.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id))
  ));

CREATE POLICY "photos_update" ON animal_photos
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = animal_photos.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id))
  ));

-- ========================
-- PHASE 3: Duplicate Cleanup
-- ========================

DROP POLICY IF EXISTS "Merchants create campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Merchants update campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Merchants view impressions" ON ad_impressions;
DROP POLICY IF EXISTS "Farmers insert order items" ON order_items;
DROP POLICY IF EXISTS "Order items visible to parties" ON order_items;
DROP POLICY IF EXISTS "Categories visible to authenticated" ON product_categories;
DROP POLICY IF EXISTS "admins_view_test_results" ON test_results;
DROP POLICY IF EXISTS "admins_view_test_runs" ON test_runs;

-- ========================
-- PHASE 4: Hardening
-- ========================

-- 4A: Drop simpler overlapping notifications SELECT
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;

-- 4B: Replace stats_job_runs inline query with has_role helper
DROP POLICY IF EXISTS "Admins can view stats job runs" ON stats_job_runs;
CREATE POLICY "Admins can view stats job runs" ON stats_job_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

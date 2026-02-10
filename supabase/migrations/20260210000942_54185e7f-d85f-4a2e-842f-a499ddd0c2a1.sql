
-- ============================================================
-- RESOLVE ALL 7 DRM OPEN QUESTIONS — SINGLE MIGRATION
-- ============================================================

-- ========== Q1: Create is_vet() helper function ==========
CREATE OR REPLACE FUNCTION public.is_vet(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships
    WHERE user_id = _user_id
      AND farm_id = _farm_id
      AND role_in_farm = 'vet'
      AND invitation_status = 'accepted'
  )
$$;

-- ========== Q1: Update health_records INSERT to include vet ==========
DROP POLICY IF EXISTS "health_insert" ON health_records;
CREATE POLICY "health_insert" ON health_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = health_records.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));

-- ========== Q1: Update injection_records INSERT to include vet ==========
DROP POLICY IF EXISTS "injection_insert" ON injection_records;
CREATE POLICY "injection_insert" ON injection_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = injection_records.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));

-- ========== Q1: Update preventive_health_schedules INSERT to include vet ==========
DROP POLICY IF EXISTS "Farm owners and managers can insert schedules" ON preventive_health_schedules;
CREATE POLICY "Farm owners and managers can insert schedules" ON preventive_health_schedules FOR INSERT
  WITH CHECK (
    is_farm_owner(auth.uid(), farm_id)
    OR is_farm_manager(auth.uid(), farm_id)
    OR is_farmhand(auth.uid(), farm_id)
    OR is_vet(auth.uid(), farm_id)
  );

-- ========== Q2: Drop duplicate distributors policies (keep shorter names) ==========
DROP POLICY IF EXISTS "Merchants can delete own distributors" ON distributors;
DROP POLICY IF EXISTS "Merchants can insert distributors" ON distributors;
DROP POLICY IF EXISTS "Merchants can view own distributors" ON distributors;
DROP POLICY IF EXISTS "Merchants can update own distributors" ON distributors;

-- ========== Q2: Drop duplicate doc_aga_faqs policies ==========
-- Keep: "Admins can manage FAQs" (ALL), "Authenticated users can view FAQs" (SELECT)
-- Drop redundant granular + duplicate SELECT policies
DROP POLICY IF EXISTS "admins_manage_faqs" ON doc_aga_faqs;
DROP POLICY IF EXISTS "admins_can_delete_faqs" ON doc_aga_faqs;
DROP POLICY IF EXISTS "admins_can_insert_faqs" ON doc_aga_faqs;
DROP POLICY IF EXISTS "admins_can_update_faqs" ON doc_aga_faqs;
DROP POLICY IF EXISTS "authenticated_read_faqs" ON doc_aga_faqs;
DROP POLICY IF EXISTS "faq_select" ON doc_aga_faqs;

-- ========== Q2: Drop duplicate invoices policies ==========
DROP POLICY IF EXISTS "Invoices visible to parties" ON invoices;
DROP POLICY IF EXISTS "Merchants create invoices" ON invoices;

-- ========== Q2: Drop duplicate orders policies ==========
DROP POLICY IF EXISTS "Farmers create orders" ON orders;
DROP POLICY IF EXISTS "Farmers view own orders" ON orders;
DROP POLICY IF EXISTS "Merchants view their orders" ON orders;
DROP POLICY IF EXISTS "Merchants update order status" ON orders;

-- ========== Q2: Drop duplicate products policies ==========
DROP POLICY IF EXISTS "Merchants can delete products" ON products;
DROP POLICY IF EXISTS "Merchants can insert products" ON products;
DROP POLICY IF EXISTS "Active products visible" ON products;
DROP POLICY IF EXISTS "Merchants can update products" ON products;

-- ========== Q2: Drop duplicate messages policies ==========
DROP POLICY IF EXISTS "Users send messages" ON messages;
DROP POLICY IF EXISTS "Users view own messages" ON messages;
DROP POLICY IF EXISTS "Users mark messages read" ON messages;

-- ========== Q3: Add farm_expenses DELETE policy ==========
CREATE POLICY "Farm owners can delete expenses"
  ON farm_expenses FOR DELETE
  USING (is_farm_owner(auth.uid(), farm_id));

-- ========== Q7: Drop superseded milking_records INSERT ==========
DROP POLICY IF EXISTS "milking_insert" ON milking_records;

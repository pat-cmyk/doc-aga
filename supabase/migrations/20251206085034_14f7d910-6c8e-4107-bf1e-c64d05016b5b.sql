-- 1. Create helper function to check order relationship
CREATE OR REPLACE FUNCTION public.has_order_with_merchant(_user_id uuid, _merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE farmer_id = _user_id
      AND merchant_id = _merchant_id
  )
$$;

-- 2. Drop duplicate overly permissive policies
DROP POLICY IF EXISTS "Verified merchants visible" ON merchants;
DROP POLICY IF EXISTS "Verified merchants visible to authenticated users" ON merchants;

-- 3. Create tiered access policies

-- Policy for customers with orders - they can see contact details
CREATE POLICY "Customers with orders can view merchant details"
ON merchants FOR SELECT
TO authenticated
USING (
  is_verified = true AND
  has_order_with_merchant(auth.uid(), id)
);

-- Policy for marketplace browsing - allows product joins to work
-- Frontend code limits field selection to non-sensitive fields
CREATE POLICY "Marketplace browse verified merchants"
ON merchants FOR SELECT
TO authenticated
USING (is_verified = true);

-- Add comment documenting the security model
COMMENT ON POLICY "Marketplace browse verified merchants" ON merchants IS 
'SECURITY NOTE: This policy enables marketplace browsing. Frontend code MUST limit field selection to: id, business_name, business_description, business_logo_url, is_verified. Contact details (contact_email, contact_phone, business_address) should only be selected when user has an order relationship.';
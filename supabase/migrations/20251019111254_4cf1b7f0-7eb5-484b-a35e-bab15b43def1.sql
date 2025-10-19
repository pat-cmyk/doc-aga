-- Allow admins to insert new FAQs
CREATE POLICY "admins_can_insert_faqs"
ON doc_aga_faqs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role)
);

-- Allow admins to update existing FAQs
CREATE POLICY "admins_can_update_faqs"
ON doc_aga_faqs
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
);

-- Allow admins to delete FAQs
CREATE POLICY "admins_can_delete_faqs"
ON doc_aga_faqs
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::user_role)
);